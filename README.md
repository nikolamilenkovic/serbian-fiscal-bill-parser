# serbian-fiscal-bill-parser

Library for parsing official fiscal bills issued in Serbia obtained via POS terminals in any store. Parser accepts raw bill text and outputs info in JSON format. Raw bill text can be obtained by scanning QR code on any bill which is a link that begins with `https://suf.purs.gov.rs/v/?vl=`.

Please note, this library is not a crawler. It is up to you to write code which gets raw bill from suf.purs.gov.rs site.

## Example usage

1. Create a new NodeJS script `app.mjs`
1. Run `npm install --save serbian-fiscal-bill-parser` in your terminal
1. Paste the following code
```JavaScript
import { SerbianFiscalBillParser } from 'serbian-fiscal-bill-parser'

let bill = 
`============ ФИСКАЛНИ РАЧУН ============
106481835
KOMPRODUKT RVU
1234567-МАРКЕТ НЕРЕВA 33
БАЛКАНСКА 123 
Београд-Стари Град
Касир:                                31
ЕСИР број:                      123/2.34
ЕСИР време:         06.05.2023. 20:33:41
-------------ПРОМЕТ ПРОДАЈА-------------
Артикли
========================================
Назив   Цена         Кол.         Укупно
112234 VODA PROLOM 1.5 L (Ђ)            
        89,99          6          539,94
----------------------------------------
Укупан износ:                     539,94
Платна картица:                   539,94
========================================
Ознака       Име      Стопа        Порез
Ђ           О-ПДВ   20,00%         89,99
----------------------------------------
Укупан износ пореза:               89,99
========================================
ПФР време:          06.05.2023. 20:33:54
ПФР број рачуна: 4A17FLHG-4WJ7FLWW-12345
8                                       
Бројач рачуна:           123456/123456ПП
========================================

======== КРАЈ ФИСКАЛНОГ РАЧУНА =========`;

let parser = new SerbianFiscalBillParser();
let result = parser.parse(bill);
console.log(JSON.stringify(result, null, ' '));
```
1. Run the script with `node app.mjs`. You should see the following output:

```JSON
{
  "company": {
    "pib": "106481835",
    "name": "KOMPRODUKT RVU",
    "city": "Београд",
    "address": "БАЛКАНСКА 123",
    "municipality": "Стари Град"
  },
  "pos": {
    "id": "1234567",
    "name": "МАРКЕТ НЕРЕВA 33"
  },
  "items": [{
    "sku": "112234",
    "name": "VODA PROLOM 1.5 L",
    "fullName": "112234 VODA PROLOM 1.5 L",
    "measurementUnit": "kom",
    "vatType": 0.2,
    "price": 539.94,
    "amount": 6,
    "unitPrice": 89.99
  }],
  "price": 539.94,
  "date": "2023-05-06T20:33:54.000Z",
  "number": "4A17FLHG-4WJ7FLWW-12345",
  "counter": "123456/123456ПП"
}
```

## Changelog
List of changes and improvements.

### 1.0.7
- Better support for a case when name is split across multiple lines (see test case 0020)

### 1.0.6
- Support for extracting SKU (product id) from line items.
- Support for full name of line items.

### 1.0.5
- Support for parsing number (PFR broj računa).
- Support for parsing counter (Brojač računa).

### 1.0.4
- Bug fix when parsing item ids.
- Added this changelog.

### 1.0.3
- Added support for obtaining date/time from bills.

### 1.0.0
- Initial version.

## Contributing

Feel free to create an issue if you notice any problems with the library. Add the link of the bill when creating an issue so that I can use it for testing. This is the link that is obtained by scanning the QR code on the bill.

Also pull requests are welcome.