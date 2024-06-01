import { Company, Item, Pos } from '.';

export class Bill {
    company: Company | null;
    pos: Pos | null;
    price: number;
    date: Date;
    number: string;
    counter: string;
    city: string;
    items: Item[] | null;
}
