import each from 'jest-each';
import { SerbianFiscalBillParser } from '../src';

describe(SerbianFiscalBillParser.name, () => {
    const parser = new SerbianFiscalBillParser();

    describe('getVatType', () => {
        const getVatType = line => parser['getVatType'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return 0 if line is %s', value => {
            // Arrange
            // Act
            let result = getVatType(value);

            // Assert
            expect(result).toBe(0);
        });

        it('should return 0.2 by default', () => {
            // Arrange
            let line = 'lorem ipsum';

            // Act
            let result = getVatType(line);

            // Assert
            expect(result).toBe(0.2);
        });

        each([
            'a', //
            'A',
            'g',
            'G',
            'г',
            'Г'
        ]).test('should return 0 for %s VAT item type', vatType => {
            // Arrange
            let line = `Напојница (${vatType}) 50,00 1 50,00`;

            // Act
            let result = getVatType(line);

            // Assert
            expect(result).toBe(0);
        });

        each([
            'e', //
            'E',
            'е',
            'Е'
        ]).test('should return 0.1 for %s VAT item type', vatType => {
            // Arrange
            let line = `Напојница (${vatType}) 50,00 1 50,00`;

            // Act
            let result = getVatType(line);

            // Assert
            expect(result).toBe(0.1);
        });
    });

    describe('getCompany', () => {
        const getCompany = text => parser['getCompany'](text);

        it('should return null if text is null', () => {
            // Arrange
            // Act
            let result = getCompany(null);

            expect(result).toBeNull();
        });

        it('should return only PIB', () => {
            // Arrange
            let data = '123456789';

            // Act
            let result = getCompany(data);

            expect(result?.pib).toBe(data);
            expect(result?.name).toBeNull();
        });

        it('should return PIB and name', () => {
            // Arrange
            let data = `111008886\r\nАПОТЕКА БОКВИЦА`;

            // Act
            let result = getCompany(data);

            // Assert
            expect(result?.pib).toBe('111008886');
            expect(result?.name).toBe('АПОТЕКА БОКВИЦА');
            expect(result?.city).toBeNull();
        });

        it('should parse data', () => {
            // Arrange
            let data = `111008886
            ЗДРАВСТВЕНА УСТАНОВА АПОТЕКА БОКВИЦА
            1042915-AU APOTEKA BOKVICA
            МИЛУТИНА МИЛАНКОВИЋА 34   
            Београд-Нови Београд`;

            // Act
            let result = getCompany(data);

            // Assert
            expect(result?.pib).toBe('111008886');
            expect(result?.city).toBe('Београд');
            expect(result?.municipality).toBe('Нови Београд');
        });
    });

    describe('getPosData', () => {
        const getPosData = head => parser['getPosData'](head);

        it('should return null if input is null', () => {
            // Arrange
            // Act
            let result = getPosData(null);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if there are less than three lines in data', () => {
            // Arrange
            let twoLines = `111008886\nАПОТЕКА БОКВИЦА`;

            // Act
            let result = getPosData(twoLines);

            // Assert
            expect(result).toBeNull();
        });

        it('should parse pos data', () => {
            // Arrange
            let head = `111008886
            АПОТЕКА БОКВИЦА
            1042915-AU APOTEKA BOKVICA
            МИЛУТИНА МИЛАНКОВИЋА 34   
            Београд-Нови Београд`;

            // Act
            let result = getPosData(head);

            // Assert
            expect(result?.id).toBe('1042915');
            expect(result?.name).toBe('AU APOTEKA BOKVICA');
        });

        it('should properly handle case when name contains dashes', () => {
            // Arrange
            let data = `103482850
            DELHAIZE SERBIA
            1000539-103-Maxi-NBG-Zemun
            ЏОНА КЕНЕДИЈА 10А   
            Београд-Нови Београд`;

            // Act
            let result = getPosData(data);

            // Assert
            expect(result?.id).toBe('1000539');
            expect(result?.name).toBe('103-Maxi-NBG-Zemun');
        });
    });

    describe('flattenItems', () => {
        const flattenItems = body => parser['flattenItems'](body);

        it('should flatten one item which is broken at the price', () => {
            // Arrange
            let body = 'Samsung K.punj.TipCnaTipC Beli (Ђ)      \n' + '     1.599,00          1        1.599,00\n';

            // Act
            let result = flattenItems(body);
            let lines = result.split('\n');

            // Assert
            expect(lines.length).toBe(1);
            expect(lines[0]).toContain('1.599,00');
        });

        it('should flatten one item which is broken in three lines', () => {
            // Arrange
            let body =
                'PLKNDEC472K - DEC Cementine Mix light be\n' + //
                'ige 200x200 Akl. 1,08 [M2 ] (Ђ)         \n' +
                '    3.866,88     12,960       50.114,76';

            // Act
            let result = flattenItems(body);
            let lines = result.split('\n');

            // Assert
            expect(lines.length).toBe(1);
            expect(lines[0]).toContain('50.114,76');
        });

        it('should flatten two items which are broken at the price', () => {
            // Arrange
            let body =
                'Достава (Ђ)                             \n' + //
                '       144,00          1          144,00\n' +
                'Напојница (Г)                           \n' +
                '       150,00          1           50,00\n';

            // Act
            let result = flattenItems(body);
            let lines = result.split('\n');

            // Assert
            expect(lines.length).toBe(2);
        });

        it('should flatten two items, second starts with serbian latin character', () => {
            // Arrange
            let body =
                'Izolir traka SPVC crna 20mx19mm Tesa kom\n' + //
                ' (Ђ)                                    \n' +
                '       199,00          1          199,00\n' +
                'Štampana kesa Okov BG 300 +(2x90)x550x0.\n' +
                '051 LDPE B kom (Ђ)                      \n' +
                '       7,00            1            7,00';

            // Act
            let result = flattenItems(body);
            let lines = result.split('\n');

            // Assert
            expect(lines.length).toBe(2);
            expect(lines[0]).toBe('Izolir traka SPVC crna 20mx19mm Tesa kom (Ђ) 199,00 1 199,00');
            expect(lines[1]).toBe('Štampana kesa Okov BG 300 +(2x90)x550x0.051 LDPE B kom (Ђ) 7,00 1 7,00');
        });
    });

    describe('getMeasurementType', () => {
        const getMeasurementType = line => parser['getMeasurementType'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return kom if line is %s', value => {
            // Arrange
            // Act
            let result = getMeasurementType(value);

            // Assert
            expect(result).toBe('kom');
        });

        each([
            ['Ananas, rinfuz/KG (Е) 129,99 1,560 202,78', 'kg'], //
            ['Čoko školjke/KOM (Ђ) 169,99 1 169,99', 'kom'],
            ['Mleko/L (Е) 109,99 1,084 216,79', 'l'],
            ['Banane, rinfuz/KG (Е) 199,99 1,084 216,79', 'kg'],
            ['Krastavac komad/PCE (Е) 59,99 1 59,99', 'pce'],
            ['Ulje od kominih maslina/L (Е) 59,99 1 59,99', 'l'],
            ['Grasak/KUT (Е) 109,99 1 109,99', 'kut'],
            ['OSN. HALJINA 89575759901 / komad', 'kom'],
        ]).test('should detect measure type with / as separator', (line, measureType) => {
            // Arrange
            // Act
            let result = getMeasurementType(line);

            // Assert
            expect(result).toBe(measureType);
        });

        each([
            ['Ananas, rinfuz(KG) (Е) 129,99 1,560 202,78', 'kg'], //
            ['Čoko školjke(KOM) (Ђ) 169,99 1 169,99', 'kom'],
            ['Mleko(L) (Е) 109,99 1,084 216,79', 'l'],
            ['Banane, rinfuz(KG) (Е) 199,99 1,084 216,79', 'kg'],
            ['Krastavac komad(PCE) (Е) 59,99 1 59,99', 'pce'],
            ['Ulje od kominih maslina(L) (Е) 59,99 1 59,99', 'l'],
            ['Grasak(KUT) (Е) 109,99 1 109,99', 'kut']
        ]).test('should detect measure type with () as separator', (line, measureType) => {
            // Arrange
            // Act
            let result = getMeasurementType(line);

            // Assert
            expect(result).toBe(measureType);
        });

        each([
            ['Ananas, rinfuz[KG] (Е) 129,99 1,560 202,78', 'kg'], //
            ['Čoko školjke[KOM] (Ђ) 169,99 1 169,99', 'kom'],
            ['Mleko[L] (Е) 109,99 1,084 216,79', 'l'],
            ['Banane, rinfuz[KG] (Е) 199,99 1,084 216,79', 'kg'],
            ['Krastavac komad[PCE] (Е) 59,99 1 59,99', 'pce'],
            ['Ulje od kominih maslina[L] (Е) 59,99 1 59,99', 'l'],
            ['Grasak[KUT] (Е) 109,99 1 109,99', 'kut'],
            ['DEC Cementine Mix light beige 200x200 Akl. 1,08 [M2 ] (Ђ) 3.866,88 12,960 50.114,76', 'm2']
        ]).test('should detect measure type with [] as separator', (line, measureType) => {
            // Arrange
            // Act
            let result = getMeasurementType(line);

            // Assert
            expect(result).toBe(measureType);
        });

        each([
            ['Ananas, rinfuz{KG} (Е) 129,99 1,560 202,78', 'kg'], //
            ['Čoko školjke{KOM} (Ђ) 169,99 1 169,99', 'kom'],
            ['Mleko{L} (Е) 109,99 1,084 216,79', 'l'],
            ['Banane, rinfuz{KG} (Е) 199,99 1,084 216,79', 'kg'],
            ['Krastavac komad{PCE} (Е) 59,99 1 59,99', 'pce'],
            ['Ulje od kominih maslina{L} (Е) 59,99 1 59,99', 'l'],
            ['Grasak{KUT} (Е) 109,99 1 109,99', 'kut']
        ]).test('should detect measure type with {} as separator', (line, measureType) => {
            // Arrange
            // Act
            let result = getMeasurementType(line);

            // Assert
            expect(result).toBe(measureType);
        });
    });

    describe('getFullItemName', () => {
        const getFullItemName = line => parser['getFullItemName'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getFullItemName(line);

            // Assert
            expect(result).toBeNull();
        });

        it('should return full name from normalized line', () => {
            // Arrange
            let line = 'Samsung K.punj.TipCnaTipC Beli (Ђ) 1.599,00 1 1.599,00';

            // Act
            let result = getFullItemName(line);

            // Assert
            expect(result).toBe('Samsung K.punj.TipCnaTipC Beli');
        });
    });

    describe('getItemSku', () => {
        const getItemSku = line => parser['getItemSku'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getItemSku(line);

            // Assert
            expect(result).toBeNull();
        });

        it('should return null if sku does not exist', () => {
            // Arrange
            let line = 'Samsung K.punj.TipCnaTipC Beli';

            // Act
            let result = getItemSku(line);

            // Assert
            expect(result).toBeNull();
        });

        each([
            ['08462 VITAMIN C CPS A10', '08462'], //
            ['08462-VITAMIN C CPS A10', '08462'],
            ['08462 - VITAMIN C CPS A10', '08462'],
            ['A08462 - VITAMIN C CPS A10', 'A08462'],
            ['Ђ08462 - VITAMIN C CPS A10', 'Ђ08462'],
            ['08462,VITAMIN C CPS A10', '08462'],
            ['08462, VITAMIN C CPS A10', '08462'],
            ['08435,Baterije (9v)', '08435'],
            ['08435,Igracke (ostalo)', '08435']
        ]).test('should return sku from the beginning', (line, target) => {
            // Arrange
            // Act
            let result = getItemSku(line);

            // Assert
            expect(result).toBe(target);
        });

        each([
            ['MAPED SESTAR TEHNIC 308 178001 (Е)/KOM', '178001'], //
            ['MAPED SESTAR TEHNIC 308,178001 (Е)/KOM', '178001'], //
            ['MAPED SESTAR TEHNIC 308-178001 (Е)/KOM', '178001'], //
            ['MAPED SESTAR TEHNIC 308 - 178001 (Е)/KOM', '178001'], //
            ['MAPED SESTAR TEHNIC 308/178001 (Е)/KOM', '178001'], //
            ['Dukatos Grčki jogurt/KOM/0246124', '0246124'],
            ['Dukatos Grčki jogurt/KOM-0246124', '0246124'],
            ['Dukatos Grčki jogurt/KOM,0246124', '0246124'],
            ['Dukatos Grčki jogurt/KOM 0246124', '0246124'],
            ['OSN. HALJINA 89575759901 / komad', '89575759901'],
        ]).test('should return sku from the end', (line, target) => {
            // Arrange
            // Act
            let result = getItemSku(line);

            // Assert
            expect(result).toBe(target);
        });
    });

    describe('getItemName', () => {
        const getItemName = (line, sku) => parser['getItemName'](line, sku);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getItemName(line, null);

            // Assert
            expect(result).toBeNull();
        });

        it('should return name from normalized line', () => {
            // Arrange
            let line = 'Samsung K.punj.TipCnaTipC Beli';

            // Act
            let result = getItemName(line, null);

            // Assert
            expect(result).toBe('Samsung K.punj.TipCnaTipC Beli');
        });

        each([
            ['08462 VITAMIN C CPS A10', '08462', 'VITAMIN C CPS A10'], //
            ['08462-VITAMIN C CPS A10', '08462', 'VITAMIN C CPS A10'],
            ['08462 - VITAMIN C CPS A10', '08462', 'VITAMIN C CPS A10'],
            ['A08462 - VITAMIN C CPS A10', 'A08462', 'VITAMIN C CPS A10'],
            ['Ђ08462 - VITAMIN C CPS A10', 'Ђ08462', 'VITAMIN C CPS A10'],
            ['08462,VITAMIN C CPS A10', '08462', 'VITAMIN C CPS A10'],
            ['08462, VITAMIN C CPS A10', '08462', 'VITAMIN C CPS A10'],
            ['08435,Baterije (9v)', '08435', 'Baterije (9v)'],
            ['08435,Igracke (ostalo)', '08435', 'Igracke (ostalo)']
        ]).test('should return name without product id at the beginning', (line, sku, target) => {
            // Arrange
            // Act
            let result = getItemName(line, sku);

            // Assert
            expect(result).toBe(target);
        });

        each([
            ['PLKNDEC472K - DEC Cementine Mix light beige 200x200 Akl. 1,08 [M2 ]', 'PLKNDEC472K - DEC Cementine Mix light beige 200x200 Akl. 1,08'] //
        ]).test('should return name with complicated product id at the beginning', (line, target) => {
            // Arrange
            // Act
            let result = getItemName(line, null);

            // Assert
            expect(result).toBe(target);
        });

        each([
            ['BMW godiste 15 (КОМ)', null, 'BMW godiste 15'],
            ['Knjiga ISBN123456789', null, 'Knjiga ISBN123456789'],
            ['BODI ŽERSEJ - MAJICA - 8683115979663 (КОМ)', '8683115979663', 'BODI ŽERSEJ - MAJICA']
        ]).test('should return name without product at the end', (line, sku, target) => {
            // Arrange
            // Act
            let result = getItemName(line, sku);

            // Assert
            expect(result).toBe(target);
        });

        each([
            ['Rotkvica, veza/KOM', null, 'Rotkvica, veza'], //
            ['Rotkvica, veza /KOM', null, 'Rotkvica, veza'],
            ['Rotkvica, veza(KOM)', null, 'Rotkvica, veza'],
            ['Rotkvica, veza (kom)', null, 'Rotkvica, veza'],
            ['Rotkvica, veza{KOM}', null, 'Rotkvica, veza'],
            ['Rotkvica, veza {kom}', null, 'Rotkvica, veza'],
            ['Rotkvica, veza[KOM]', null, 'Rotkvica, veza'],
            ['Rotkvica, veza [kom]', null, 'Rotkvica, veza'],
            ['Mleko/л', null, 'Mleko'],
            ['Ulje komine masline/л', null, 'Ulje komine masline'],
            ['Baterije (9v)(kom)', null, 'Baterije (9v)'],
            ['001234-Baterije (9v)(kom)', '001234', 'Baterije (9v)'],
            ['Ceger višenamenski 45x40x20cm sort A.I.&amp;E. kom', null, 'Ceger višenamenski 45x40x20cm sort A.I.&amp;E.'],
            ['Izolir traka SPVC crna 20mx19mm Tesa kom', null, 'Izolir traka SPVC crna 20mx19mm Tesa']
        ]).test('should return name without measurement type', (line, sku, target) => {
            // Arrange
            // Act
            let result = getItemName(line, sku);

            // Assert
            expect(result).toBe(target);
        });

        each([
            ['(30 min)Uklanjanje kamenca (odrasli) /КОМ', '(30 min)Uklanjanje kamenca (odrasli)'], //
            ['(30 min) Uklanjanje kamenca (odrasli) /КОМ', '(30 min) Uklanjanje kamenca (odrasli)'], //
            ['{30 min}Uklanjanje kamenca (odrasli) /КОМ', '{30 min}Uklanjanje kamenca (odrasli)'],
            ['{30 min} Uklanjanje kamenca (odrasli) /КОМ', '{30 min} Uklanjanje kamenca (odrasli)'],
            ['[30 min]Uklanjanje kamenca (odrasli) /КОМ', '[30 min]Uklanjanje kamenca (odrasli)'],
            ['[30 min] Uklanjanje kamenca (odrasli) /КОМ', '[30 min] Uklanjanje kamenca (odrasli)']
        ]).test('should return name without cutting first bracketed text', (line, target) => {
            // Arrange
            // Act
            let result = getItemName(line, null);

            // Assert
            expect(result).toBe(target);
        });
    });

    describe('getItemPrice', () => {
        const getItemPrice = line => parser['getItemPrice'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getItemPrice(line);

            // Assert
            expect(result).toBeNull();
        });

        each([
            ['1', 1], //
            ['9,99', 9.99],
            ['99,99', 99.99],
            ['1.009,99', 1009.99],
            ['1009,99', 1009.99],
            ['1.911.119,1', 1911119.1]
        ]).test('should properly extract price', (price, target) => {
            // Arrange
            let line = `PITA HELJDINA PAPRIKA SPANAC (Е) 120,00 1 ${price}`;

            // Act
            let result = getItemPrice(line);

            // Assert
            expect(result).toBe(target);
        });

        it('should return 0 if price is text instead of number', () => {
            // Arrange
            let line = `PITA HELJDINA PAPRIKA SPANAC (Е) 120,00 1 lorem_ipsum`;

            // Act
            let result = getItemPrice(line);

            // Assert
            expect(result).toBe(0);
        });
    });

    describe('getItemAmount', () => {
        const getItemAmount = line => parser['getItemAmount'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getItemAmount(line);

            // Assert
            expect(result).toBeNull();
        });

        each([
            ['1', 1], //
            ['9,99', 9.99],
            ['99,99', 99.99],
            ['1.009,99', 1009.99],
            ['1009,99', 1009.99],
            ['1.911.119,1', 1911119.1]
        ]).test('should properly extract item amount', (amount, target) => {
            // Arrange
            let line = `PITA HELJDINA PAPRIKA SPANAC (Е) 120,00 ${amount} 120,00`;

            // Act
            let result = getItemAmount(line);

            // Assert
            expect(result).toBe(target);
        });

        it('should return 1 if amount is text instead of number', () => {
            // Arrange
            let line = `PITA HELJDINA PAPRIKA SPANAC (Е) 120,00 lorem_ipsum 120,00`;

            // Act
            let result = getItemAmount(line);

            // Assert
            expect(result).toBe(1);
        });
    });

    describe('getDate', () => {
        const getDate = line => parser['getDate'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getDate(line);

            // Assert
            expect(result).toBeNull();
        });

        it('should return date from line', () => {
            // Arrange
            let line = 'ПФР време:          06.05.2023. 10:55:09';

            // Act
            let result = getDate(line);

            // Assert
            expect(result).toEqual(new Date('2023-05-06T10:55:09.000Z'));
        });
    });

    describe('getNumber', () => {
        const getNumber = line => parser['getNumber'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getNumber(line);

            // Assert
            expect(result).toBeNull();
        });

        it('should return number from line', () => {
            // Arrange
            let line = 'ПФР број рачуна: 0000-0000000000000';

            // Act
            let result = getNumber(line);

            // Assert
            expect(result).toBe('0000-0000000000000');
        });

        it('should return number if it spans multiple lines', () => {
            // Arrange
            let segment = `
                ========================================
                ПФР време:          22.05.2024. 19:31:16
                ПФР број рачуна: 00000000-00000000-00000
                1111111111111111111111111111111111111111
                2222222222222222222222222222222222222222
                Бројач рачуна:           124721/127141ПП
                ========================================`;

            // Act
            let result = getNumber(segment);

            // Assert
            expect(result).toBe('00000000-00000000-0000011111111111111111111111111111111111111112222222222222222222222222222222222222222');
        });

        it('should return number if it spans multiple lines with CRLF as new lines', () => {
            // Arrange
            let segment =
                '========================================\r\n' + //
                'ПФР време:          22.05.2024. 19:31:16\r\n' +
                'ПФР број рачуна: 00000000-00000000-00000\r\n' +
                '1111111111111111111111111111111111111111\r\n' +
                '2222222222222222222222222222222222222222\r\n' +
                'Бројач рачуна:           124721/127141ПП\r\n' +
                '========================================';

            // Act
            let result = getNumber(segment);

            // Assert
            expect(result).toBe('00000000-00000000-0000011111111111111111111111111111111111111112222222222222222222222222222222222222222');
        });
    });

    describe('getCounter', () => {
        const getCounter = line => parser['getCounter'](line);

        each([
            undefined, //
            null,
            ''
        ]).test('should return null if input is %s', line => {
            // Arrange
            // Act
            let result = getCounter(line);

            // Assert
            expect(result).toBeNull();
        });

        it('should return counter from line', () => {
            // Arrange
            let line = 'Бројач рачуна:           124721/127141ПП';

            // Act
            let result = getCounter(line);

            // Assert
            expect(result).toBe('124721/127141ПП');
        });

        it('should return counter if it spans multiple lines', () => {
            // Arrange
            let segment = `
                ========================================
                ПФР време:          22.05.2024. 19:31:16
                ПФР број рачуна: 00000000-00000000-00000
                Бројач рачуна: 1111111111111111111111111
                2222222222222222222222222222222/22222222
                33333333333333333333333333333333333333ПП
                ========================================`;

            // Act
            let result = getCounter(segment);

            // Assert
            expect(result).toBe('11111111111111111111111112222222222222222222222222222222/2222222233333333333333333333333333333333333333ПП');
        });

        it('should return counter if it spans multiple lines with CRLF as new lines', () => {
            // Arrange
            let segment =
                '========================================\r\n' + //
                'ПФР време:          22.05.2024. 19:31:16\r\n' +
                'ПФР број рачуна: 00000000-00000000-00000\r\n' +
                'Бројач рачуна: 1111111111111111111111111\r\n' +
                '2222222222222222222222222222222/22222222\r\n' +
                '33333333333333333333333333333333333333ПП\r\n' +
                '========================================';

            // Act
            let result = getCounter(segment);

            // Assert
            expect(result).toBe('11111111111111111111111112222222222222222222222222222222/2222222233333333333333333333333333333333333333ПП');
        });
    });
});
