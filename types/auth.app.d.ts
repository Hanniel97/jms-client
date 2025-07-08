import { GestureResponderEvent, KeyboardTypeOptions } from "react-native";

export interface IProps {
    children: React.ReactNode;
    classs?: string; 
}
  
export interface InputProps {
    onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
    label?: string;
    onChangeText: (text: string) => void;
    icon0?: JSX.Element | null;
    icon?: JSX.Element | null;
    IsSecureText?: boolean | undefined;
    keyboardType?: KeyboardTypeOptions | undefined;
    placeholder?: string | undefined;
    value?: string,
    error?: string;
    country?: string;
}

export interface InputsSearchProps {
    onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
    label?: string;
    onChangeText?: (text: string) => void;
    icon?: JSX.Element | null;
    keyboardType?: KeyboardTypeOptions | undefined;
    placeholder?: string | undefined;
    IsSecureText?: boolean | false;
    value?: string
    multiline?: boolean | false,
    textInputClassNames?: string
    onSubmitEditing?: any;
    editable?: boolean;
}

export interface InputsReviewProps {
    onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
    onChangeText: (text: string) => void;
    icon?: JSX.Element | null;
    keyboardType?: KeyboardTypeOptions | undefined;
    placeholder?: string | undefined;
    value?: string,
    error?: string;
}
  
export interface CustomButtonProps {
    onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
    buttonClassNames?: string;
    textClassNames?: string;
    buttonText?: string;
    buttonTextSpan?: string,
    spanClassNames?: string;
    loading?: boolean | false,
    disable?: any | false;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right";
}

export interface CustomHeader {
    onPress?: null | ((event: GestureResponderEvent) => void) | undefined;
    title?: string,
    props?: object
}

export interface LocationInputProps {
    placeholder: string,
    type: "pickup" | "drop",
    value: string,
    onChangeText: (text: string) => void,
    onFocus: () => void,
}