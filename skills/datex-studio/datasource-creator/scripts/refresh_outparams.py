#!/usr/bin/env python3
"""Detect and repair OData datasource output-parameter drift.

An oDataQuery datasource carries its result shape twice: `queryOptionsObjectTypeDef`
and the result node inside `outParams`. Both are GENERATED from `queryOptions`
(selects + expands). When a select/expand is added to the query without the Studio
designer regenerating them, branch validation fails with:

    Selected property 'X' is missing from the entity definition
    Expanded property 'A.B' is missing from the entity definition
    Output parameters do not match the entity definition, linked datasources and
    custom columns. Open the datasource in Studio and save it to refresh them.

"entity definition" means the datasource's OWN declared type tree, not the OData
schema -- the properties usually still exist in metadata.xml. This script is the
CLI equivalent of the designer's open-and-save refresh.

Usage:
  refresh_outparams.py report --file <envelope.json> --metadata <metadata.xml>
  refresh_outparams.py fix    --file <envelope.json> --out <body.json> --metadata <metadata.xml>

`--metadata` must point at the OData metadata.xml for the datasource's target
environment/connection — there is no default path; pass whichever copy matches
the branch's connection.
"""
import argparse, json, re, sys

EDM = {
    'Edm.Int16':'number','Edm.Int32':'number','Edm.Int64':'number','Edm.Byte':'number',
    'Edm.SByte':'number','Edm.Decimal':'number','Edm.Double':'number','Edm.Single':'number',
    'Edm.String':'string','Edm.Guid':'string','Edm.Binary':'string',
    'Edm.Boolean':'boolean',
    'Edm.DateTimeOffset':'date','Edm.Date':'date','Edm.Duration':'string','Edm.TimeOfDay':'string',
}
NODE_KEYS = ['id','required','description','oneOf','fromBaseConfiguration','removed','type',
             'objectType','isCollection','isSecured','isConstant','constantValue']

def blank(id_, type_, is_collection=False, children=None):
    n = {k: None for k in NODE_KEYS}
    n['id'] = id_; n['type'] = type_; n['isCollection'] = bool(is_collection)
    n['objectTypeDef'] = children          # explicit null for scalars, as the designer emits
    return n

class Schema:
    """Minimal OData metadata reader: entity set -> entity type -> properties."""
    def __init__(self, path):
        self.ok = False
        if not path: return
        try: s = open(path, encoding='utf-8', errors='ignore').read()
        except OSError: return
        self.sets = dict(re.findall(r'<EntitySet Name="([^"]+)"\s+EntityType="([^"]+)"', s))
        self.types = {}
        self.keys = {}
        for m in re.finditer(r'<EntityType Name="([^"]+)"[^>]*>(.*?)</EntityType>', s, re.S):
            name, blk = m.group(1), m.group(2)
            km = re.search(r'<Key>(.*?)</Key>', blk, re.S)
            self.keys[name] = re.findall(r'<PropertyRef Name="([^"]+)"', km.group(1)) if km else []
            props = dict(re.findall(r'<Property Name="([^"]+)" Type="([^"]+)"', blk))
            navs = {}
            for nm in re.finditer(r'<NavigationProperty Name="([^"]+)" Type="([^"]+)"', blk):
                t = nm.group(2); coll = t.startswith('Collection(')
                inner = t[len('Collection('):-1] if coll else t   # prefix, not str.strip (char-set!)
                navs[nm.group(1)] = (inner, coll)
            self.types[name] = (props, navs)
        self.ok = True
    def type_of_set(self, es):
        fq = self.sets.get(es, '') if self.ok else ''
        return fq.split('.')[-1]
    def prop_type(self, tname, prop):
        if not self.ok: return None
        props, _ = self.types.get(tname, ({}, {}))
        return EDM.get(props.get(prop, ''), None)
    def key_of(self, tname):
        return (self.keys.get(tname) or []) if self.ok else []

    def nav(self, tname, prop):
        if not self.ok: return (None, None)
        _, navs = self.types.get(tname, ({}, {}))
        t, coll = navs.get(prop, (None, None))
        return (t.split('.')[-1] if t else None, coll)

def live(items):
    return [i for i in (items or []) if not i.get('removed')]

def walk(qo, tree, schema, tname, path, missing):
    """Compare one query level against one type-def level."""
    have = {n.get('id') for n in (tree or [])}
    for s in live(qo.get('selects')):
        p = s['property']
        if p not in have:
            missing.append((path + [p], 'select', schema.prop_type(tname, p) or 'string', False, None))
    for e in live(qo.get('expands')):
        p = e['property']
        nt, coll = schema.nav(tname, p)
        is_coll = e.get('isCollection') if e.get('isCollection') is not None else bool(coll)
        if p not in have:
            missing.append((path + [p], 'expand', 'object', is_coll, (e.get('queryOptions'), nt)))
        else:
            child = next(n for n in tree if n.get('id') == p)
            walk(e.get('queryOptions') or {}, child.get('objectTypeDef') or [], schema, nt, path + [p], missing)

def order_key(schema, tname):
    keys = schema.key_of(tname)
    def k(name):
        return (0, keys.index(name)) if name in keys else (1, name)
    return k

def build(qo, schema, tname):
    k = order_key(schema, tname)
    out = [blank(s['property'], schema.prop_type(tname, s['property']) or 'string')
           for s in live(qo.get('selects'))]
    out.sort(key=lambda n: k(n['id']))
    for e in live(qo.get('expands')):
        nt, coll = schema.nav(tname, e['property'])
        is_coll = e.get('isCollection') if e.get('isCollection') is not None else bool(coll)
        out.append(blank(e['property'], 'object', is_coll,
                         build(e.get('queryOptions') or {}, schema, nt)))
    return out

def insert(tree, qo, schema, tname):
    """Add every missing select/expand node at this level and restore the designer's order.

    Rebuilds the level as [key scalars, other scalars A-Z, expands in query order], reusing the
    existing node objects so untouched subtrees keep their identity. Anything already present but
    not in the query is kept at the end rather than dropped."""
    by_id = {n.get('id'): n for n in tree}
    added, scalars, objects = [], [], []
    for s in live(qo.get('selects')):
        p = s['property']
        n = by_id.get(p)
        if n is None:
            n = blank(p, schema.prop_type(tname, p) or 'string'); added.append(p)
        scalars.append(n)
    scalars.sort(key=lambda n: order_key(schema, tname)(n['id']))
    for e in live(qo.get('expands')):
        p = e['property']; nt, coll = schema.nav(tname, p)
        is_coll = e.get('isCollection') if e.get('isCollection') is not None else bool(coll)
        inner = e.get('queryOptions') or {}
        n = by_id.get(p)
        if n is None:
            n = blank(p, 'object', is_coll, build(inner, schema, nt)); added.append(p)
        else:
            if n.get('objectTypeDef') is None:
                n['objectTypeDef'] = []
            added += [p + '.' + a for a in insert(n['objectTypeDef'], inner, schema, nt)]
        objects.append(n)
    placed = {id(n) for n in scalars + objects}
    leftover = [n for n in tree if id(n) not in placed]
    tree[:] = scalars + objects + leftover
    return added

def result_node(body):
    """The outParams entry holding the row shape."""
    for n in body.get('outParams') or []:
        if n.get('type') == 'object' and n.get('objectTypeDef') is not None:
            return n
    return None

def load(path):
    d = json.load(open(path))
    b = d.get('json', d)
    return json.loads(b) if isinstance(b, str) else b

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['report', 'fix'])
    ap.add_argument('--file', required=True)
    ap.add_argument('--out')
    ap.add_argument('--metadata', required=True, help='Path to the OData metadata.xml for the target environment/connection.')
    a = ap.parse_args()

    body = load(a.file)
    if body.get('type') != 'oDataQuery':
        print(json.dumps({'skipped': 'not an oDataQuery datasource', 'type': body.get('type')})); return 0
    schema = Schema(a.metadata)
    if not schema.ok:
        print(json.dumps({'error': 'metadata not readable: ' + a.metadata})); return 3
    es = (body.get('paths') or [{}])[0].get('entitySet')
    tname = schema.type_of_set(es)
    qo = body.get('queryOptions') or {}
    rnode = result_node(body)

    targets = [('queryOptionsObjectTypeDef', body.get('queryOptionsObjectTypeDef'))]
    if rnode is not None:
        targets.append(('outParams.result.objectTypeDef', rnode.get('objectTypeDef')))

    if a.mode == 'report':
        rep = {'referenceName': body.get('referenceName'), 'entitySet': es, 'entityType': tname, 'missing': {}}
        for label, tree in targets:
            miss = []
            walk(qo, tree or [], schema, tname, [], miss)
            rep['missing'][label] = ['.'.join(p) + f' ({k}, {t}{", collection" if c else ""})'
                                     for p, k, t, c, _ in miss]
        rep['clean'] = all(not v for v in rep['missing'].values())
        print(json.dumps(rep, indent=1)); return 0

    added = {}
    for label, tree in targets:
        if tree is None: continue
        added[label] = insert(tree, qo, schema, tname)
    json.dump(body, open(a.out, 'w'), indent=1)
    print(json.dumps({'referenceName': body.get('referenceName'), 'added': added, 'out': a.out}, indent=1))
    return 0

sys.exit(main())
