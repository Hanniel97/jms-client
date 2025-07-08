import React, { useState } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Icon } from '@rneui/base';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

interface Props {
    date: Date | null;
    onChange: (date: Date) => void;
}

const DateOfBirthPicker: React.FC<Props> = ({ date, onChange }) => {
    const [showPicker, setShowPicker] = useState(false);

    const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowPicker(false);
        if (event.type === 'set' && selectedDate) {
            onChange(selectedDate);
        }
    };

    return (
        <Pressable onPress={() => setShowPicker(true)} className="w-full bg-gray-200/20 border border-gray-200 rounded-xl h-[55px] p-1  mb-1 flex items-center flex-row">
            {/* <Button
                title={date ? date.toLocaleDateString() : 'Choisir une date de naissance'}
                onPress={() => setShowPicker(true)}
            /> */}
            <View className="flex items-center justify-center h-[38px] w-[38px]">
                <Icon name="calendar" type='ionicon' size={20} color="#000000" />
            </View>
            <Text style={{ flex: 0.8 }}> {date ? moment(date).format("LL") : 'Choisir une date de naissance'} </Text>
            {showPicker && (
                <DateTimePicker
                    value={date || new Date(2000, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={handleChange}
                />
            )}
        </Pressable>
    );
};

export default DateOfBirthPicker;
