export interface IPosition {
    longitude: number,
    latitude: number,
    address: string | null,
    heading?: number;
}

export interface IUser {
    _id: string,
    role: string,
    phone: string,
    email: string,
    nom: string,
    prenom: string,
    sexe: string,
    birthday: date,
    pushNotificationToken: string,
    photo: string,
    disabled: boolean,
    wallet: number,
    idCard: string,
    verified: boolean,
    otp: string,
}

export interface ITransaction {
    _id: string,
    user: IUser,
    type: string,
    amount: number,
    title: string,
    createdAt: date,
    updatedAt: date
}

interface IAdress {
    address: string,
    latitude: number,
    longitude: number,
}

export interface IRide {
    _id: string,
    vehicle: string,
    distance: number,
    pickup: IAdress,
    drop: IAdress,
    fare: number,
    customer: IUser,
    rider: IUser,
    status: string,
    paymentMethod: string,
    otp: string,
    createdAt: date,
    updatedAt: date
}

export interface IRatting {
    _id: string,
    note: number,
    customer: IUser,
    rider: IUser,
    createdAt: date,
    updatedAt: date
}

export interface INotification {
    _id: string,
    user: IUser,
    type: string,
    body: string,
    title: string,
    isRead: boolean,
    createdAt: date,
    updatedAt: date
}

export interface ICar {
    _id: string,
    user: IUser,
    marque: string,
    model: string,
    immatriculation: string,
    permis: string,
    carteGrise: string,
    assurance: string,
    visiteTechnique: string,
    photosVehicule: [string],
    createdAt: date,
    updatedAt: date
}