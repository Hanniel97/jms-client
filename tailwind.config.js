/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#FF6D00",
                secondary: "#4CAF50", //Vert moyen
                secondarylight: "#A1D9C3", //Vert clair
                secondarypale: "#E7F6F0", //Vert pâle
                accent: "#FFA726", //Jaune doré
                accentred: "#EF5350", //Rouge doux
                textwhite: "#FFFFFF", //Teste blanc
                textgray: "#BDBDBD", //Teste gris
                textprimary: "#2E2E2E", //Teste noir
                textsecondary: "#666666", //Teste gris moyen

                dark: {
                    background: "#0F172A",
                    primary: "#0E3B2A",
                    secondary: "#81C784",
                    secondarylight: "#264B42",
                    secondarypale: "#1A2E2A",
                    accent: "#FFB74D",
                    accentred: "#E57373",
                    textwhite: "#FFFFFF",
                    textgray: "#9E9E9E",
                    textprimary: "#E5E5E5",
                    textsecondary: "#AAAAAA",
                }
            },
        },
    },
    plugins: [],
};
