# Bill of Lading - Field Mapping

**Connection ID:** 9
**Branch:** 73658
**Root Entity:** `Shipments` (key: `Id`)

## Root-Level Fields (DataSet: Shipments)

These fields come from the Shipment entity and its single-value navigation properties. One row per shipment.

| Report Field | OData Path | Source Entity | Notes |
|---|---|---|---|
| **Identifiers** | | | |
| BOL Number | `BillOfLading` | Shipment | Primary BOL identifier, String(64) |
| Shipment ID | `LookupCode` | Shipment | Shipment lookup code, String(64) |
| Reference Number | `ReferenceNumber` | Shipment | String(128) |
| Tracking Number | `TrackingIdentifier` | Shipment | String(256) |
| Booking Number | `BookingNumber` | Shipment | String(50) |
| Packing Slip | `PackingSlip` | Shipment | String(128) |
| PRO Number | `BrokerReference` | Shipment | String(32), often used as PRO number |
| **Carrier Info** | | | |
| Carrier Name | `Carrier.Name` | Carrier | $expand=Carrier, String(64) |
| Carrier Short Name | `Carrier.ShortName` | Carrier | String(16) |
| SCAC Code | `Carrier.ScacCode` | Carrier | Standard Carrier Alpha Code, String(4) |
| Service Type | `CarrierServiceType.Name` | CarrierServiceType | $expand=CarrierServiceType, String(64) |
| Freight Terms | `FreightTerm.Name` | FreightTerm | $expand=FreightTerm (Prepaid/Collect/etc.), String(128) |
| Trailer Number | `TrailerId` | Shipment | String(64) |
| Seal Number | `SealId` | Shipment | String(64) |
| **Shipper (From)** | | | |
| Shipper Company | `Account.Name` | Account | $expand=Account, String(256) |
| Shipper Account Code | `Account.LookupCode` | Account | String(128) |
| Shipper Contact Name | `Contact.FirstName` / `Contact.LastName` | Contact | $expand=Contact, concatenate first+last |
| Shipper Phone | `Contact.PrimaryTelephone` | Contact | String(50) |
| Shipper Email | `Contact.PrimaryEmail` | Contact | String(128) |
| Shipper Address Line 1 | `Contact.Address.Line1` | Address | $expand=Contact($expand=Address), String(128) |
| Shipper Address Line 2 | `Contact.Address.Line2` | Address | String(128) |
| Shipper City | `Contact.Address.City` | Address | String(64) |
| Shipper State | `Contact.Address.State` | Address | String(64) |
| Shipper Postal Code | `Contact.Address.PostalCode` | Address | String(64) |
| Shipper Country | `Contact.Address.Country` | Address | String(32) |
| **Consignee (To)** | | | |
| Consignee Company | `ShipToAccount.Name` | Account | $expand=ShipToAccount, String(256) |
| Consignee Account Code | `ShipToAccount.LookupCode` | Account | String(128) |
| Consignee Contact Name | `ShipToContact.FirstName` / `ShipToContact.LastName` | Contact | $expand=ShipToContact, concatenate |
| Consignee Phone | `ShipToContact.PrimaryTelephone` | Contact | String(50) |
| Consignee Email | `ShipToContact.PrimaryEmail` | Contact | String(128) |
| Consignee Address Line 1 | `ShipToContact.Address.Line1` | Address | $expand=ShipToContact($expand=Address) |
| Consignee Address Line 2 | `ShipToContact.Address.Line2` | Address | String(128) |
| Consignee City | `ShipToContact.Address.City` | Address | String(64) |
| Consignee State | `ShipToContact.Address.State` | Address | String(64) |
| Consignee Postal Code | `ShipToContact.Address.PostalCode` | Address | String(64) |
| Consignee Country | `ShipToContact.Address.Country` | Address | String(32) |
| **Dates** | | | |
| Ship Date | `ShippedDate` | Shipment | DateTimeOffset, format as date |
| Expected Date | `ExpectedDate` | Shipment | DateTimeOffset |
| Delivery Date | `DeliveredDate` | Shipment | DateTimeOffset |
| Pickup Date | `PickupDate` | Shipment | DateTimeOffset |
| Date Needed | `DateNeeded` | Shipment | DateTimeOffset |
| Date Promised | `DatePromised` | Shipment | DateTimeOffset |
| **Totals & Misc** | | | |
| Total Gross Weight | `GrossWeight` | Shipment | Decimal |
| Total Net Weight | `NetWeight` | Shipment | Decimal |
| Weight UOM | `WeightUOM.Short_name` | MeasurementUnit | Requires separate lookup via WeightUomId |
| Pallet Count | `PalletCount` | Shipment | Decimal |
| Item Count | `ItemCount` | Shipment | Decimal |
| FOB Location | `FobLocation` | Shipment | String(256) |
| Incoterms | `Incoterms` | Shipment | String(50) |
| Container ID | `ContainerIdentifier` | Shipment | String(64) |
| Container Size | `ContainerSize` | Shipment | String(16) |
| Shipment Status | `Status.Name` | ShipmentStatus | $expand=Status, String(128) |
| Special Instructions | `Notes` | Shipment | String (unlimited) |
| Origin Warehouse | `ExpectedWarehouse.Name` | Warehouse | $expand=ExpectedWarehouse, String(128) |

## Collection Fields - Shipment Lines (DataSet: ShipmentLines)

These fields require a separate DataSet because ShipmentLines is a one-to-many collection. Filter by `ShipmentId`.

| Report Field | OData Path | Source Entity | Notes |
|---|---|---|---|
| **Line Identification** | | | |
| Line Number | `LineNumber` | ShipmentLine | Int32 |
| Order ID | `OrderId` | ShipmentLine | Int32, FK to Orders |
| Order Line Number | `OrderLineNumber` | ShipmentLine | Int32 |
| **Quantities** | | | |
| Expected Quantity | `ExpectedAmount` | ShipmentLine | Decimal |
| Actual Quantity | `ActualAmount` | ShipmentLine | Decimal |
| Expected Pkg Qty | `ExpectedPackagedAmount` | ShipmentLine | Decimal |
| Actual Pkg Qty | `ActualPackagedAmount` | ShipmentLine | Decimal |
| **Packaging** | | | |
| Expected Package | `ExpectedPackaged.Name` | InventoryMeasurementUnit | $expand=ExpectedPackaged |
| Actual Package | `ActualPackaged.Name` | InventoryMeasurementUnit | $expand=ActualPackaged |
| **Weights & Volumes** | | | |
| Line Gross Weight | `GrossWeight` | ShipmentLine | Decimal |
| Line Net Weight | `NetWeight` | ShipmentLine | Decimal |
| Line Gross Volume | `GrossVolume` | ShipmentLine | Decimal |
| Line Net Volume | `NetVolume` | ShipmentLine | Decimal |
| Weight UOM | `WeightUOM.Short_name` | MeasurementUnit | $expand=WeightUOM |
| Volume UOM | `VolumeUOM.Short_name` | MeasurementUnit | $expand=VolumeUOM |
| **Item Details (via OrderLine)** | | | |
| Item Code | `OrderLine.Material.LookupCode` | Material | $expand=OrderLine($expand=Material) |
| Item Name | `OrderLine.Material.Name` | Material | String(128) |
| Commodity Description | `OrderLine.Material.Description` | Material | String(1024), main BOL line description |
| NMFC Number | `OrderLine.Material.NmfcNumber` | Material | NMFC classification |
| NMFC Sub-Number | `OrderLine.Material.NmfcSubNumber` | Material | NMFC sub-classification |
| Material Alias | `OrderLine.MaterialAlias` | OrderLine | String(256) |
| Ordered Quantity | `OrderLine.Amount` | OrderLine | Decimal |
| PO Number | `OrderLine.PurchaseOrderIdentifier` | OrderLine | String(32) |
| Line Notes | `OrderLine.Notes` | OrderLine | String |
| Order Number | `OrderLine.Order.LookupCode` | Order | $expand=OrderLine($expand=Order) |
| **Freight Class (via OrderLine -> MaterialPackagingLookup)** | | | |
| Freight Class | `OrderLine.MaterialPackagingLookup.FreightClass.Name` | FreightClass | Deep expand required |
| Freight Class Short | `OrderLine.MaterialPackagingLookup.FreightClass.ShortName` | FreightClass | String(32) |
| Pkg Weight | `OrderLine.MaterialPackagingLookup.Weight` | MaterialsPackagingsLookup | Decimal |
| Pkg Shipping Weight | `OrderLine.MaterialPackagingLookup.ShippingWeight` | MaterialsPackagingsLookup | Decimal |
| Pkg Length | `OrderLine.MaterialPackagingLookup.Length` | MaterialsPackagingsLookup | Decimal |
| Pkg Width | `OrderLine.MaterialPackagingLookup.Width` | MaterialsPackagingsLookup | Decimal |
| Pkg Height | `OrderLine.MaterialPackagingLookup.Height` | MaterialsPackagingsLookup | Decimal |

## Alternative/Supplemental: Order Addresses (DataSet: OrderAddresses)

OrderAddresses provides per-order address overrides (shipper/consignee). Filter by `Orderid` and `Type.Name` (e.g., "Ship From", "Ship To"). Use this if order-level addresses differ from the Shipment-level Contact addresses.

| Report Field | OData Path | Source Entity | Notes |
|---|---|---|---|
| Address Type | `Type.Name` | OrderAddressesType | $expand=Type; filter for "Ship From" or "Ship To" |
| Company Name | `Name` | OrderAddress | String(256) |
| Attention Of | `AttentionOf` | OrderAddress | String(64) |
| Contact First Name | `FirstName` | OrderAddress | String(32) |
| Contact Last Name | `LastName` | OrderAddress | String(32) |
| Address Line 1 | `Line1` | OrderAddress | String(128) |
| Address Line 2 | `Line2` | OrderAddress | String(128) |
| Address Line 3 | `Line3` | OrderAddress | String(128) |
| Address Line 4 | `Line4` | OrderAddress | String(128) |
| City | `City` | OrderAddress | String(64) |
| State | `State` | OrderAddress | String(64) |
| Postal Code | `PostalCode` | OrderAddress | String(64) |
| Country | `Country` | OrderAddress | String(32) |
| Phone | `PrimaryTelephone` | OrderAddress | String(50) |
| Email | `PrimaryEmail` | OrderAddress | String(128) |
| Fax | `PrimaryFax` | OrderAddress | String(50) |
| Reference Code | `ReferenceCode` | OrderAddress | String(32) |

## OData Query Patterns

### Root dataset (Shipment header)
```
Shipments?$filter=Id eq {shipmentId}
  &$select=BillOfLading,LookupCode,ReferenceNumber,TrackingIdentifier,
    BookingNumber,PackingSlip,BrokerReference,TrailerId,SealId,
    ShippedDate,ExpectedDate,DeliveredDate,PickupDate,DateNeeded,DatePromised,
    GrossWeight,NetWeight,PalletCount,ItemCount,
    FobLocation,Incoterms,ContainerIdentifier,ContainerSize,Notes
  &$expand=Carrier($select=Name,ShortName,ScacCode),
    CarrierServiceType($select=Name),
    FreightTerm($select=Name),
    Account($select=Name,LookupCode),
    ShipToAccount($select=Name,LookupCode),
    Contact($select=FirstName,LastName,PrimaryTelephone,PrimaryEmail;$expand=Address($select=Line1,Line2,City,State,PostalCode,Country)),
    ShipToContact($select=FirstName,LastName,PrimaryTelephone,PrimaryEmail;$expand=Address($select=Line1,Line2,City,State,PostalCode,Country)),
    Status($select=Name),
    ExpectedWarehouse($select=Name)
```

### Line items dataset (ShipmentLines)
```
ShipmentLines?$filter=ShipmentId eq {shipmentId}
  &$select=LineNumber,OrderId,OrderLineNumber,
    ExpectedAmount,ActualAmount,ExpectedPackagedAmount,ActualPackagedAmount,
    GrossWeight,NetWeight,GrossVolume,NetVolume
  &$expand=ExpectedPackaged($select=Name,ShortName),
    ActualPackaged($select=Name,ShortName),
    WeightUOM($select=Name,Short_name),
    VolumeUOM($select=Name,Short_name),
    OrderLine($select=Amount,MaterialAlias,PurchaseOrderIdentifier,Notes;
      $expand=Material($select=LookupCode,Name,Description,NmfcNumber,NmfcSubNumber),
        MaterialPackagingLookup($select=Weight,ShippingWeight,Length,Width,Height;
          $expand=FreightClass($select=Name,ShortName)),
        Order($select=LookupCode))
```

### Order addresses dataset (if needed)
```
OrderAddresses?$filter=Orderid eq {orderId}
  &$expand=Type($select=Name)
```

## Notes

- **Two address strategies:** The Shipment has Contact/ShipToContact (with nested Address) for shipper/consignee. Orders have OrderAddresses (typed by OrderAddressesType). Either can serve as the BOL address source. OrderAddresses has more fields (Line3, Line4) and is more likely to contain order-specific overrides.
- **Freight class** requires a deep expand path: `ShipmentLine -> OrderLine -> MaterialPackagingLookup -> FreightClass`. This may need to be flattened or pre-joined depending on report engine capabilities.
- **Weight UOM** on Shipment uses `WeightUomId` but there is no direct nav property named `WeightUOM` on Shipment (unlike ShipmentLine). May need separate lookup or include the UOM Id and resolve in-report.
- **Multiple orders per shipment:** A shipment can contain lines from multiple orders. The `ShipmentOrderLookup` entity maps this. Line items will have different `OrderId` values.
