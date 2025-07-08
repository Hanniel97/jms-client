import React from 'react';
import { SectionList, Text, View } from 'react-native';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

type Props<T> = {
    data: T[];
    dateKey: keyof T;
    renderItem: ({ item }: { item: T }) => React.ReactElement;
    keyExtractor?: (item: T, index: number) => string;
    sectionHeaderStyle?: string;
    renderSectionHeader?: (title: string) => React.ReactElement;
};

type GroupedItem<T> = {
    title: string;
    data: T[];
};

function groupByDate<T>(items: T[], dateKey: keyof T): GroupedItem<T>[] {
    const grouped: { [key: string]: T[] } = {};

    items.forEach((item) => {
        const date = moment(item[dateKey] as string);
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

function GroupedList<T>({
    data,
    dateKey,
    renderItem,
    keyExtractor = (item, index) => index.toString(),
    sectionHeaderStyle,
    renderSectionHeader,
}: Props<T>) {
    const sections = groupByDate(data, dateKey);

    return (
        <SectionList
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) =>
                renderSectionHeader ? (
                    renderSectionHeader(title)
                ) : (
                    <View className={sectionHeaderStyle || 'bg-white px-4 py-2'}>
                        <Text className="text-gray-800 font-bold text-base">{title}</Text>
                    </View>
                )
            }
        />
    );
}

export default GroupedList;
