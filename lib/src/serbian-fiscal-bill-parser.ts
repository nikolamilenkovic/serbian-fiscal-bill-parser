import { Bill, Company, Item, Pos } from '.';

export class SerbianFiscalBillParser {
    public parse(bill: string): Bill | null {
        let result = new Bill();

        let head = bill
            .split('-------------ПРОМЕТ ПРОДАЈА-------------')[0] //
            .replace('============ ФИСКАЛНИ РАЧУН ============\n', '');

        result.company = this.getCompany(head);
        result.pos = this.getPosData(head);

        let itemsReceiptInitial = bill
            .split('========================================')[1] //
            .split('----------------------------------------')[0]
            .split('Укупно')[1];

        let items: Item[] = [];
        let flattenedItems = this.flattenItems(itemsReceiptInitial).split('\n');
        for (const flattenedItem of flattenedItems) {
            const fullName = this.getFullItemName(flattenedItem);
            const sku = this.getItemSku(fullName);
            var item = new Item({
                sku: sku,
                name: this.getItemName(fullName, sku),
                fullName: fullName,
                measurementUnit: this.getMeasurementType(flattenedItem),
                vatType: this.getVatType(flattenedItem),
                price: this.getItemPrice(flattenedItem),
                amount: this.getItemAmount(flattenedItem),
                unitPrice: this.getItemUnitPrice(flattenedItem)
            });
            items.push(item);
        }
        result.items = items;

        let total = bill.split('Укупан износ:')[1];
        const totalRegex = /[0-9.,]+/;
        const totalMatch = total.match(totalRegex);
        if (totalMatch && totalMatch[0]) {
            let totalAmountString = totalMatch[0].replace(/[.]/g, '').replace(',', '.');
            let totalAmount = Number.parseFloat(totalAmountString);
            if (Number.isNaN(totalAmount)) {
                result.price = 0;
            } else {
                result.price = totalAmount;
            }
        }

        const date = this.getDate(bill);
        if (date) {
            result.date = date;
        }

        const number = this.getNumber(bill);
        if (number) {
            result.number = number;
        }

        const counter = this.getCounter(bill);
        if (counter) {
            result.counter = counter;
        }

        return result;
    }

    /**
     * Removes unnecessary line breaks from items in body section of the bill.
     * This ensures that items will be in one line only with measurement unit.
     * @param line
     */
    private flattenItems(body: string): string {
        let bodyLines = body.replace(/\r\n/g, '\n').split('\n');
        let lines: string[] = [];

        let flattenedLine = '';
        for (let i = 0; i < bodyLines.length; i++) {
            const bodyLine = bodyLines[i];

            // Empty lines should be ignored
            if (bodyLine === '') {
                continue;
            }

            // Check if line starts with whitespaces
            if (bodyLine.match(/^[ ]+/)) {
                // If line starts with whitespaces, check if it starts with price in format 9.999,99
                let first = bodyLine.trim().split(' ')[0].replace('.', '').replace(',', '.');
                let endsWithPrice = bodyLine.trim().match(/[0-9.,]+$/);
                try {
                    let price = Number.parseFloat(first);
                    if (!Number.isNaN(price) && endsWithPrice) {
                        flattenedLine += bodyLine;
                        flattenedLine = flattenedLine.replace(/[ ]+/g, ' '); // Merge multiple spaces into one
                        lines.push(flattenedLine);
                        flattenedLine = '';
                        continue;
                    }
                } catch (err) {
                    /* Not a number */
                }
            }

            flattenedLine += bodyLine;
            
            // Merge multiple spaces into one
            flattenedLine = flattenedLine.replace(/[ ]+/g, ' ');
        }

        const result = lines.join('\n');
        return result;
    }

    /**
     * Gets VAT type
     * @param line Flattened line item in the bill
     * @returns VAT amount (0 for 0%, 0.1 for 10% or 0.2 for 20%)
     */
    private getVatType(line: string): 0 | 0.1 | 0.2 {
        if (!line) {
            return 0;
        }

        if (line.indexOf('(e)') !== -1 || line.indexOf('(E)') !== -1) {
            return 0.1;
        } else if (line.indexOf('(е)') !== -1 || line.indexOf('(Е)') !== -1) {
            return 0.1;
        } else if (line.indexOf('(a)') !== -1 || line.indexOf('(A)') !== -1) {
            return 0;
        } else if (line.indexOf('(g)') !== -1 || line.indexOf('(G)') !== -1) {
            return 0;
        } else if (line.indexOf('(г)') !== -1 || line.indexOf('(Г)') !== -1) {
            return 0;
        }

        return 0.2;
    }

    /**
     * Gets measurement type
     * @param line Flattened line item in the bill
     * @returns by default 'kom' if nothin specified, or 'kg', 'l', 'kut', 'pce' or 'm'
     */
    private getMeasurementType(line: string): 'kom' | 'kg' | 'l' | 'kut' | 'pce' | 'm' | 'm2' {
        if (!line) {
            return 'kom';
        }

        const lineLowercased = line.toLowerCase();

        const measurements = {
            kom: ['kom', 'ком', 'komad'], //
            kg: ['kg', 'кг'],
            l: ['l', 'л'],
            kut: ['kut', 'кут'],
            pce: ['pce', 'пце'],
            m: ['m', 'м'],
            m2: ['m2', 'м2']
        };

        for (const key of Object.keys(measurements)) {
            const measures = measurements[key];
            for (const measureType of measures) {
                if (
                    lineLowercased.match(`/${measureType}`) || // /kg
                    lineLowercased.match(`\\([ ]?${measureType}[ ]?\\)`) || //(kg)
                    lineLowercased.match(`\\[[ ]?${measureType}[ ]?\\]`) || //[kg]
                    lineLowercased.match(`\{[ ]?${measureType}[ ]?\}`) // {kg}
                ) {
                    return key as 'kom' | 'kg' | 'l' | 'kut' | 'pce' | 'm' | 'm2';
                }
            }
        }

        return 'kom';
    }

    /**
     * Gets the line item SKU (aka product id)
     * @param line Flattened line item in the bill, without price and vat type
     * @returns SKU of the item
     */
    private getItemSku(line: string | null): string | null {
        if (!line || line.length === 0) {
            return null;
        }

        // If result starts with number (product id), remove it. Id:
        // - can be numeric only 9999
        // - can start with character A9999
        // - can be separated from name with - (and spaces between)
        // - can be separated from name with , (and spaces between)
        // - cannot start with ( or [ or {, for example "(30 min) Massage" is not an item which starts with an id
        const idPrefixRegex = /^([^0-9({\[]?\d+)[ ]*[-,]*/;
        const idPrefixMatch = line.match(idPrefixRegex);
        if (idPrefixMatch) {
            let idPrefix = idPrefixMatch[1];
            return idPrefix.trim();
        }

        line = this.removeMeasurementType(line);

        // If result ends with number (product id), remove it. Id:
        // - must have at least 4 digits to be considered id
        // - can be numeric only 9999
        // - can start with character A9999
        // - can be separated from name with comma, dash or slash (and spaces between)
        const idSuffixRegex = /[ ]*[-,/]?[ ]*(\D?\d{4,})[ ]*$/;
        const idSuffixMatch = line.match(idSuffixRegex);
        if (idSuffixMatch) {
            let idSuffix = idSuffixMatch[1];
            return idSuffix.trim();
        }

        // No id found
        return null;
    }

    /**
     * Get item name without id prefix
     * @param line Flattened line item in the bill
     * @returns name of the item, without id and measurement unit
     */
    private getItemName(line: string | null, sku: string | null): string | null {
        if (!line) {
            return null;
        }

        let result = line;
        let skuRemoved = false;

        if (sku) {
            // Remove sku (product id)
            result = result.replace(sku, '');

            // Remove dash or comma after sku
            const dashAfterSku = /^[ ]*[-,][ ]*/;
            if (result.match(dashAfterSku)) {
                result = result.replace(dashAfterSku, '').trim();
            }

            // Remove dash, slash or comma before sku
            const dashBeforeSku = /[ ]*[-\/,]$/;
            if (result.match(dashBeforeSku)) {
                result = result.replace(dashBeforeSku, '').trim();
            }
            skuRemoved = true;
        }

        result = this.removeMeasurementType(result);

        if (skuRemoved) {
            // Remove dash, slash or comma if they left after all the trimmings
            const dashBeforeSku = /[ ]*[-\/,][ ]*$/;
            if (result.match(dashBeforeSku)) {
                result = result.replace(dashBeforeSku, '');
            }
        }

        return result?.trim();
    }

    /**
     * Gets company information from head part of the bill
     * @param head Data between '== ФИСКАЛНИ РАЧУН ==' and '--ПРОМЕТ ПРОДАЈА--'
     * @returns Company info (pib, name, city, address, municipality)
     */
    private getCompany(head: string): Company | null {
        if (!head) {
            return null;
        }

        let lines = head.replace(/\r\n/, '\n').split('\n');

        let pib = lines[0] ?? null;
        let name = lines[1] ?? null;
        let address = lines[3] ?? null;
        let city = lines[4] ?? null;
        let municipality = lines[4] ?? null;
        if (city && city.indexOf('-') !== -1) {
            city = lines[4].split('-')[0].trim();
            municipality = lines[4].split('-')[1].trim();
        }

        return new Company({
            pib: pib?.trim() ?? null,
            name: name?.trim() ?? null,
            city: city?.trim() ?? null,
            address: address?.trim() ?? null,
            municipality: municipality?.trim() ?? null
        });
    }

    /**
     * Gets POS info from head part of the bill
     * @param head Data between '== ФИСКАЛНИ РАЧУН ==' and '--ПРОМЕТ ПРОДАЈА--'
     * @returns id and name of the device
     */
    private getPosData(head: string): Pos | null {
        if (!head) {
            return null;
        }

        let lines = head.replace(/\r\n/, '\n').split('\n');
        if (lines.length < 3) {
            return null;
        }

        let posId = lines[2].split('-')[0]?.trim();
        let posName = lines[2]?.replace(posId, '')?.trim();
        posName = posName?.replace(/^-/, ''); // Remove dash from the beginning

        return new Pos({
            id: posId,
            name: posName
        });
    }

    /**
     * Gets total price of an item
     * @param line Flattened line item in the bill
     * @returns total price for an item (unit price * amount)
     */
    private getItemPrice(line: string): number | null {
        if (!line) {
            return null;
        }

        const priceRegex = /[0-9.,]+$/;
        const priceMatch = line.match(priceRegex);
        if (!priceMatch) {
            return 0;
        }

        var price = priceMatch[0];
        price = price.replace(/[.]/g, '').replace(',', '.');

        const result = Number.parseFloat(price);
        if (Number.isNaN(result)) {
            return 0;
        }

        return result;
    }

    /**
     * Gets the amount of line item
     * @param line Flattened line item in the bill
     * @returns amount from the line item
     */
    private getItemAmount(line: string): number | null {
        if (!line) {
            return null;
        }

        const lastNumberRegex = /[0-9.,]+$/;
        const lineNoPrice = line.replace(lastNumberRegex, '').trim(); // Remove last number which is price

        const amountMatch = lineNoPrice.match(lastNumberRegex);
        if (!amountMatch) {
            return 1;
        }

        const amount = amountMatch[0].replace(/[.]/g, '').replace(',', '.');
        const result = Number.parseFloat(amount);
        if (Number.isNaN(result)) {
            return 1;
        }

        return result;
    }

    private getFullItemName(line: string): string | null {
        if (!line) {
            return null;
        }

        const start = 0;
        let end = line.length - 1;
        const vat = line.match(/\(\D\)/);
        if (vat) {
            end = line.lastIndexOf(vat[0]);
        }

        const result = line.substring(start, end)?.trim();
        return result;
    }

    /**
     * Gets item unit price
     * @param line Flattened line item in the bill
     * @returns unit price
     */
    private getItemUnitPrice(line: string): number | null {
        if (!line) {
            return null;
        }

        const lastNumberRegex = /[0-9.,]+$/;
        const lineNoPrice = line.replace(lastNumberRegex, '').trim(); // Remove last number which is price
        const lineNoAmount = lineNoPrice.replace(lastNumberRegex, '').trim(); // Remove 2nd number from end which is amount

        const unitPriceMatch = lineNoAmount.match(lastNumberRegex);
        if (!unitPriceMatch) {
            return 0;
        }

        const amount = unitPriceMatch[0].replace(/[.]/g, '').replace(',', '.');
        const result = Number.parseFloat(amount);
        if (Number.isNaN(result)) {
            return 1;
        }

        return result;
    }

    /**
     * Gets date from the bill
     * @param bill Raw bill text
     * @returns Date of the bill
     */
    private getDate(bill: string): Date | null {
        if (!bill) {
            return null;
        }

        const dateString = bill.split('ПФР време:')[1].match(/[ .:0-9]+/);
        if (dateString) {
            const rawDate = dateString[0].trim();
            const dateParts = rawDate.split('.');
            const timeParts = rawDate.split(' ')[1].split(':');

            const date = new Date(Number.parseInt(dateParts[2]), Number.parseInt(dateParts[1]) - 1, Number.parseInt(dateParts[0]), Number.parseInt(timeParts[0]), Number.parseInt(timeParts[1]), Number.parseInt(timeParts[2]));
            return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
        }

        return null;
    }

    /**
     * Gets bill number AKA 'PFR broj racuna'
     * @param bill Raw bill text
     * @returns Bill number AKA 'PFR broj racuna'
     */
    private getNumber(bill: string): string | null {
        if (!bill) {
            return null;
        }

        const numberStringRaw = bill.split('ПФР број рачуна:')[1];
        if (!numberStringRaw) {
            return null;
        }

        const numberString = numberStringRaw
            .split('Бројач рачуна:')[0] //
            .replace(/ /g, '')
            .replace(/\r\n/g, '')
            .replace(/\n/g, '');
        return numberString.trim();
    }

    /**
     * Gets counter number AKA 'Brojac racuna'
     * @param bill Raw bill text
     * @returns Counter number AKA 'Brojac racuna'
     */
    private getCounter(bill: string): string | null {
        if (!bill) {
            return null;
        }

        const counterStringRaw = bill.split('Бројач рачуна:')[1];
        if (!counterStringRaw) {
            return null;
        }

        const counterString = counterStringRaw.split('=')[0].replace(/ /g, '').replace(/\r\n/g, '').replace(/\n/g, '');
        return counterString.trim();
    }

    /**
     * Removes measurement type from the line
     * @param line Line without price and vat type
     * @returns Line item without measurement type
     */
    private removeMeasurementType(line: string): string {
        // If results ends with measurement type, remove it
        const slashMeasurement = /\/\D{1,3}\d?$/i;
        if (line.match(slashMeasurement)) {
            line = line.replace(slashMeasurement, '');
        }
        const bracketsMeasurement = /\([ ]?\D{1,3}\d?[ ]?\)$/i;
        if (line.match(bracketsMeasurement)) {
            line = line.replace(bracketsMeasurement, '');
        }
        const squareBracketsMeasurement = /\[[ ]?\D{1,3}\d?[ ]?\]$/i;
        if (line.match(squareBracketsMeasurement)) {
            line = line.replace(squareBracketsMeasurement, '');
        }
        const curlyBracketsMeasurement = /\{[ ]?\D{1,3}\d?[ ]?\}$/i;
        if (line.match(curlyBracketsMeasurement)) {
            line = line.replace(curlyBracketsMeasurement, '');
        }
        const spaceMeasurement = /[ /]+(kom|kg|komad)[ ]*$/i;
        if (line.match(spaceMeasurement)) {
            line = line.replace(spaceMeasurement, '');
        }

        return line;
    }
}
