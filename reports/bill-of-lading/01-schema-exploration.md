# Bill of Lading - Schema Exploration Notes

**Connection ID:** 9
**Branch:** 73658
**Date:** 2026-03-18

## Search Results Summary

### Keywords searched
- `shipment` - Found **Shipments**, ShipmentLines, ShipmentOrderLookup, ShipmentStatuses, ShipmentLoadingInstructions, ShipmentRoutings, and others
- `bill of lading` - No direct match (field lives on Shipment entity as `BillOfLading`)
- `BOL` - No direct match
- `outbound` - Found OutboundOrderPriorities, OutboundProcessingStrategies
- `shipping` - Found ShippingContainers, ShippingManifests, ShippingHubShipments
- `order` - Found **Orders**, **OrderLines**, **OrderAddresses**, OrderStatuses, OrderTypes, OrderClasses
- `carrier` - Found **Carriers**, **CarrierServices**, **CarrierServiceTypes**
- `freight` - Found **FreightClasses**, **FreightTerms**
- `commodity` - No match (commodity info lives on Material as Description)

## Key Entities

### Shipments (root entity for BOL report)
- **Entity type:** `Datex.FootPrint.Api.Shipment`
- **Entity set:** `Shipments`
- **Key:** `Id` (Int32)
- **BOL-relevant properties:**
  - `BillOfLading` (String, max 64) - the BOL number itself
  - `LookupCode` (String, max 64) - shipment lookup code
  - `ReferenceNumber` (String, max 128)
  - `TrackingIdentifier` (String, max 256)
  - `TrailerId` (String, max 64)
  - `SealId` (String, max 64)
  - `Notes` (String)
  - `GrossWeight` (Decimal)
  - `NetWeight` (Decimal)
  - `WeightUomId` (Int32) -> MeasurementUnit
  - `PalletCount` (Decimal)
  - `ItemCount` (Decimal)
  - `CarrierId` (Int32) -> Carrier
  - `CarrierServiceTypeId` (Int32) -> CarrierServiceType
  - `FreightTermId` (Int32) -> FreightTerm
  - `AccountId` (Int32) -> Account (shipper/owner)
  - `ShipToAccountId` (Int32) -> Account (consignee)
  - `ContactId` (Int32) -> Contact
  - `ShipToContactId` (Int32) -> Contact
  - `ShippedDate` (DateTimeOffset)
  - `ExpectedDate` (DateTimeOffset)
  - `DeliveredDate` (DateTimeOffset)
  - `PickupDate` (DateTimeOffset)
  - `DateNeeded` (DateTimeOffset)
  - `DatePromised` (DateTimeOffset)
  - `StatusId` (Int32) -> ShipmentStatus
  - `FobLocation` (String, max 256)
  - `Incoterms` (String, max 50)
  - `ContainerIdentifier` (String, max 64)
  - `ContainerSize` (String, max 16)
  - `BookingNumber` (String, max 50)
  - `BrokerReference` (String, max 32)
  - `PackingSlip` (String, max 128)
  - `ExpectedWarehouseId` (Int32) -> Warehouse

### ShipmentLines (collection - line items on a shipment)
- **Entity type:** `Datex.FootPrint.Api.ShipmentLine`
- **Entity set:** `ShipmentLines`
- **Key:** `Id` (Int32)
- **Properties:**
  - `LineNumber` (Int32)
  - `ShipmentId` (Int32) -> Shipment
  - `OrderId` (Int32)
  - `OrderLineNumber` (Int32)
  - `ExpectedAmount` (Decimal)
  - `ActualAmount` (Decimal)
  - `ExpectedPackagedAmount` (Decimal)
  - `ActualPackagedAmount` (Decimal)
  - `ExpectedPackagedId` (Int32) -> InventoryMeasurementUnit
  - `ActualPackagedId` (Int32) -> InventoryMeasurementUnit
  - `GrossWeight` (Decimal)
  - `NetWeight` (Decimal)
  - `GrossVolume` (Decimal)
  - `NetVolume` (Decimal)
  - `WeightUomId` (Int32) -> MeasurementUnit
  - `VolumeUomId` (Int32) -> MeasurementUnit
  - `StatusId` (Int32) -> ShipmentLineStatus
- **Navigation properties:**
  - `OrderLine` -> OrderLine (via OrderId+OrderLineNumber)
  - `Shipment` -> Shipment
  - `ExpectedPackaged` -> InventoryMeasurementUnit
  - `ActualPackaged` -> InventoryMeasurementUnit
  - `WeightUOM` -> MeasurementUnit
  - `VolumeUOM` -> MeasurementUnit
  - `Status` -> ShipmentLineStatus

### Orders
- **Entity type:** `Datex.FootPrint.Api.Order`
- **Key:** `Id` (Int32)
- **BOL-relevant properties:**
  - `LookupCode` (String, max 128) - order number
  - `OwnerReference` (String, max 64)
  - `VendorReference` (String, max 64)
  - `Notes` (String, max 4000)
  - `RequestedDeliveryDate` (DateTimeOffset)
  - `PreferredCarrierId` (Int32) -> Carrier
  - `PreferredCarrierServiceTypeId` (Int32) -> CarrierServiceType
  - `ShippingAddressId` (Int32)
- **Navigation properties:**
  - `OrderLines` -> OrderLine (many)
  - `Addresses` -> OrderAddress (many) - contains shipper/consignee addresses
  - `Account` -> Account
  - `PreferredCarrier` -> Carrier
  - `Status` -> OrderStatus
  - `ShipmentOrderLookups` -> ShipmentOrderLookup (many)

### OrderLines
- **Entity type:** `Datex.FootPrint.Api.OrderLine`
- **Key:** `OrderId` (Int32) + `LineNumber` (Int32)
- **BOL-relevant properties:**
  - `Amount` (Decimal) - ordered quantity
  - `PackagedAmount` (Decimal)
  - `PackagedId` (Int32) -> InventoryMeasurementUnit
  - `MaterialId` (Int32) -> Material
  - `MaterialAlias` (String, max 256)
  - `GrossWeight` (Decimal)
  - `NetWeight` (Decimal)
  - `WeightUomId` (Int32) -> MeasurementUnit
  - `Cost` (Decimal)
  - `Price` (Decimal)
  - `Notes` (String)
  - `PurchaseOrderIdentifier` (String, max 32)
- **Navigation properties:**
  - `Material` -> Material
  - `InventoryMeasurementUnit` -> InventoryMeasurementUnit (packaging)
  - `MaterialPackagingLookup` -> MaterialsPackagingsLookup
  - `ShipmentLines` -> ShipmentLine (many)
  - `Order` -> Order
  - `WeightUom` -> MeasurementUnit

### OrderAddresses (collection - multiple addresses per order)
- **Entity type:** `Datex.FootPrint.Api.OrderAddress`
- **Key:** `Id` (Int32)
- **Properties:**
  - `Orderid` (Int32) -> Order
  - `TypeId` (Int32) -> OrderAddressesType (distinguishes shipper vs consignee)
  - `Name` (String, max 256)
  - `AttentionOf` (String, max 64)
  - `Line1` (String, max 128)
  - `Line2` (String, max 128)
  - `Line3` (String, max 128)
  - `Line4` (String, max 128)
  - `City` (String, max 64)
  - `State` (String, max 64)
  - `PostalCode` (String, max 64)
  - `Country` (String, max 32)
  - `PrimaryTelephone` (String, max 50)
  - `PrimaryEmail` (String, max 128)
  - `PrimaryFax` (String, max 50)
  - `FirstName` (String, max 32)
  - `LastName` (String, max 32)
  - `ReferenceCode` (String, max 32)
- **Navigation:**
  - `Type` -> OrderAddressesType (has Name like "Ship From", "Ship To", etc.)
  - `Order` -> Order

### OrderAddressesType (lookup for address types)
- **Key:** `Id` (Int32)
- **Properties:** `Name` (String, max 32), `SystemDefined` (Boolean)

### Carriers
- **Entity type:** `Datex.FootPrint.Api.Carrier`
- **Key:** `Id` (Int32)
- **Properties:**
  - `Name` (String, max 64)
  - `ShortName` (String, max 16)
  - `ScacCode` (String, max 4) - SCAC code for BOL

### CarrierServiceTypes
- **Entity type:** `Datex.FootPrint.Api.CarrierServiceType`
- **Key:** `Id` (Int32)
- **Properties:**
  - `Name` (String, max 64)
  - `ShortName` (String, max 64)

### FreightTerms
- **Entity type:** `Datex.FootPrint.Api.FreightTerm`
- **Key:** `Id` (Int32)
- **Properties:** `Name` (String, max 128)

### FreightClasses
- **Entity type:** `Datex.FootPrint.Api.FreightClass`
- **Key:** `Id` (Int32)
- **Properties:** `Name` (String, max 128), `ShortName` (String, max 32)

### Materials
- **Entity type:** `Datex.FootPrint.Api.Material`
- **Key:** `Id` (Int32)
- **BOL-relevant properties:**
  - `LookupCode` (String, max 256) - item/SKU code
  - `Name` (String, max 128) - item name
  - `Description` (String, max 1024) - commodity description for BOL
  - `NmfcNumber` (String) - NMFC number
  - `NmfcSubNumber` (String) - NMFC sub-number
  - `CommodityCode` (String, UDF) - commodity code

### MaterialsPackagingsLookup (dimensions & freight class per material+packaging)
- **Entity type:** `Datex.FootPrint.Api.MaterialsPackagingsLookup`
- **Key:** `MaterialId` + `PackagingId`
- **BOL-relevant properties:**
  - `FreightClassId` (Int32) -> FreightClass
  - `Weight` (Decimal)
  - `ShippingWeight` (Decimal)
  - `Height` (Decimal)
  - `Length` (Decimal)
  - `Width` (Decimal)
  - `Volume` (Decimal)
  - `ShippingVolume` (Decimal)
  - `TareWeight` (Decimal)
  - `WeightUomId` (Int32) -> MeasurementUnit
  - `DimensionUomId` (Int32) -> MeasurementUnit
  - `VolumeUomId` (Int32) -> MeasurementUnit
- **Navigation:**
  - `FreightClass` -> FreightClass
  - `WeightUom` -> MeasurementUnit
  - `DimensionsUom` -> MeasurementUnit

### Account (shipper / consignee company)
- **Entity type:** `Datex.FootPrint.Api.Account`
- **Key:** `Id` (Int32)
- **Properties:** `Name` (String, max 256), `LookupCode` (String, max 128)

### Contact (shipper / consignee contact person)
- **Entity type:** `Datex.FootPrint.Api.Contact`
- **Key:** `Id` (Int32)
- **Properties:**
  - `FirstName` (String, max 128)
  - `LastName` (String, max 128)
  - `PrimaryTelephone` (String, max 50)
  - `PrimaryEmail` (String, max 128)
  - `AddressId` (Int32) -> Address
- **Navigation:** `Address` -> Address

### Address (physical address for contacts)
- **Entity type:** `Datex.FootPrint.Api.Address`
- **Key:** `Id` (Int32)
- **Properties:** `Line1`, `Line2`, `City`, `State`, `PostalCode`, `Country`, `AttentionOf`

### Warehouse
- **Entity type:** `Datex.FootPrint.Api.Warehouse`
- **Key:** `Id` (Int32)
- **Properties:** `Name` (String, max 128), `AddressId` (Int32)

### MeasurementUnit
- **Key:** `Id` (Int32)
- **Properties:** `Name` (String, max 64), `Short_name` (String, max 16)

### ShipmentStatus
- **Key:** `Id` (Int32)
- **Properties:** `Name` (String, max 128)

## Data Model Relationships for BOL

```
Shipments (root)
  ├── Carrier -> Carriers (name, SCAC code)
  ├── CarrierServiceType -> CarrierServiceTypes (service level)
  ├── FreightTerm -> FreightTerms (prepaid/collect/third-party)
  ├── Account -> Accounts (shipper company)
  ├── Contact -> Contacts -> Address (shipper contact + address)
  ├── ShipToAccount -> Accounts (consignee company)
  ├── ShipToContact -> Contacts -> Address (consignee contact + address)
  ├── ExpectedWarehouse -> Warehouses (origin warehouse)
  ├── Status -> ShipmentStatuses
  ├── ShipmentLines (collection) ──┐
  │     ├── OrderLine -> OrderLines │
  │     │     ├── Material -> Materials (item desc, NMFC)
  │     │     ├── MaterialPackagingLookup -> MaterialsPackagingsLookup
  │     │     │     ├── FreightClass -> FreightClasses
  │     │     │     ├── WeightUom -> MeasurementUnits
  │     │     │     └── DimensionsUom -> MeasurementUnits
  │     │     └── Order -> Orders
  │     │           └── Addresses -> OrderAddresses (shipper/consignee addresses)
  │     │                 └── Type -> OrderAddressesType
  │     ├── WeightUOM -> MeasurementUnits
  │     └── VolumeUOM -> MeasurementUnits
  └── OrderLookups -> ShipmentOrderLookup (shipment-to-order mapping)
```

## Important Design Notes

1. **Address sourcing:** BOL addresses come from two potential sources:
   - **OrderAddresses** (per-order, typed by OrderAddressesType - e.g., "Ship From", "Ship To")
   - **Contact.Address** (via Shipment.Contact/ShipToContact navigation)
   - OrderAddresses is more specific to the order; Contact.Address is the master contact address.

2. **Freight class** lives on `MaterialsPackagingsLookup` (not Material or OrderLine directly). Access via `OrderLine.MaterialPackagingLookup.FreightClass.Name`.

3. **NMFC** is on the `Material` entity directly: `Material.NmfcNumber` and `Material.NmfcSubNumber`.

4. **Weight** is available at multiple levels:
   - Shipment level: `GrossWeight`, `NetWeight` (totals)
   - ShipmentLine level: `GrossWeight`, `NetWeight`
   - OrderLine level: `GrossWeight`, `NetWeight`
   - MaterialsPackagingsLookup: `Weight`, `ShippingWeight`, `TareWeight`

5. **ShipmentLines** is the collection that bridges shipments to order lines. Each ShipmentLine links to one OrderLine, which links to Material.
