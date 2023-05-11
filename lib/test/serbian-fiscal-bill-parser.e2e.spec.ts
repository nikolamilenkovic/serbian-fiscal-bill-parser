import each from 'jest-each';
import { resolve } from 'path';
import { readdirSync, readFileSync } from 'fs';
import { SerbianFiscalBillParser } from '../src';

describe(SerbianFiscalBillParser.name + ' E2E tests', () => {
    const testCaseDirs = readdirSync(resolve(__dirname, 'cases'), { withFileTypes: true })
        //.filter(d => d.isDirectory() && d.name === '0014') //
        .map(d => resolve(__dirname, 'cases', d.name));
    
    each(testCaseDirs).test('%s', caseDir => {
        // Arrange
        const parser = new SerbianFiscalBillParser();
        const rawBill = readFileSync(resolve(caseDir, 'bill.txt')).toString();
        const expected = require(resolve(caseDir, 'bill.json'));

        // Act
        const result = parser.parse(rawBill);
        const resultJson = JSON.stringify(result, null, 2);

        // console.log(resultJson);

        // Assert
        expect(resultJson).toBe(JSON.stringify(expected, null, 2));
    });
});
