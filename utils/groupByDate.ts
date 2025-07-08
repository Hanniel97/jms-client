import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

export type GroupedItem<T> = {
    title: string;
    data: T[];
};

export function groupByDate<T>(items: T[], dateKey: keyof T): GroupedItem<T>[] {
    const grouped: { [key: string]: T[] } = {};

    items.forEach((item) => {
        const rawDate = item[dateKey];
        const date = moment(rawDate as string);

        let groupTitle = '';
        if (date.isSame(moment(), 'day')) groupTitle = "Aujourd'hui";
        else if (date.isSame(moment().subtract(1, 'day'), 'day')) groupTitle = 'Hier';
        else groupTitle = date.format('D MMMM YYYY');

        if (!grouped[groupTitle]) grouped[groupTitle] = [];
        grouped[groupTitle].push(item);
    });

    return Object.entries(grouped)
        .map(([title, data]) => ({ title, data }))
        .sort((a, b) => {
            const dateA = moment(a.data[0][dateKey] as string);
            const dateB = moment(b.data[0][dateKey] as string);
            return dateB.diff(dateA);
        });
}
