import { INotification } from '@/types';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

type GroupedNotifications = {
    title: string;
    data: INotification[];
};

export const groupNotificationsByDate = (notifications: INotification[]): GroupedNotifications[] => {
    const grouped: { [key: string]: INotification[] } = {};

    notifications.forEach((notif) => {
        const date = moment(notif.createdAt);
        let groupTitle = '';

        if (date.isSame(moment(), 'day')) {
            groupTitle = "Aujourd'hui";
        } else if (date.isSame(moment().subtract(1, 'day'), 'day')) {
            groupTitle = 'Hier';
        } else {
            groupTitle = date.format('D MMMM YYYY');
        }

        if (!grouped[groupTitle]) {
            grouped[groupTitle] = [];
        }

        grouped[groupTitle].push(notif);
    });

    // Transformer l’objet en tableau et trier du plus récent au plus ancien
    return Object.entries(grouped)
        .map(([title, data]) => ({ title, data }))
        .sort((a, b) => {
            const dateA = moment(a.data[0].createdAt);
            const dateB = moment(b.data[0].createdAt);
            return dateB.diff(dateA);
        });
};
