import { GOOGLE_API_KEY } from "@/services/api";

export const reverseGeocode = async (
    latitude: number,
    longitude: number
): Promise<string | null> => {
    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}&language=fr`
        );
        const data = await res.json();

        if (
            data.status === "OK" &&
            Array.isArray(data.results) &&
            data.results.length > 0
        ) {
            return data.results[0].formatted_address;
        } else {
            console.warn("Aucune adresse trouvée pour ces coordonnées.");
            return "";
        }
    } catch (error) {
        console.error("Erreur reverse geocoding :", error);
        return null;
    }
};

const calculateControlPoint = (p1: any, p2: any) => {
    const d = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
    const scale = 1;
    const h = d * scale;
    const w = d / 2;
    const x_m = (p1[0] + p2[0]) / 2;
    const y_m = (p1[1] + p2[1]) / 2;

    const x_c =
        x_m +
        ((h * (p2[1] - p1[1])) /
            (2 * Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2))) * (w / d);

    const y_c =
        y_m -
        ((h * (p2[0] - p1[0])) /
            (2 * Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2))) * (w / d);

    const controlPoint = [x_c, y_c];
    return controlPoint;
}

const quadraticBezierCurve = (
    p0: [number, number],
    p2: [number, number],
    p1: [number, number],
    segments: number = 100
): { latitude: number; longitude: number }[] => {
    const curve: { latitude: number; longitude: number }[] = [];

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;

        const x =
            (1 - t) * (1 - t) * p0[0] +
            2 * (1 - t) * t * p1[0] +
            t * t * p2[0];
        const y =
            (1 - t) * (1 - t) * p0[1] +
            2 * (1 - t) * t * p1[1] +
            t * t * p2[1];

        curve.push({ latitude: x, longitude: y });
    }

    return curve;
};

export const getPoints = (places: any) => {
    const p1 = [places[0].latitude, places[0].longitude];
    const p2 = [places[1].latitude, places[1].longitude];
    const controlPoint = calculateControlPoint(p1, p2)

    return quadraticBezierCurve(p1, p2, controlPoint, 100)
}

export const vehiculeIcons: Record<'eco' | 'confort', { icon: any }> = {
    eco: {
        icon: require('../assets/images/Taxi_confort_gris_miroir.png'),
    },
    confort: {
        icon: require('../assets/images/Taxi_confort_blanc_recadre.png'),
    },
};