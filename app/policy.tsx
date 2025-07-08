/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="mb-5">
        <Text className="text-base mb-1 font-['RubikMedium']">{title}</Text>
        <Text className="text-sm leading-6 text-gray-700 font-['RubikRegular']">{children}</Text>
    </View>
);

export default function policy() {
    const insets = useSafeAreaInsets();
    
    return (
        <View style={{marginBottom: insets.bottom}} className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title={"Politique de confidentialité"} />

            <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ justifyContent: "center" }}>
                <Text className="text-2xl mb-1 font-['RubikRegular']">Politique de Confidentialité</Text>
                <Text className="text-xs text-gray-500 mb-4 font-['RubikRegular']">Dernière mise à jour : 23 juin 2025</Text>

                <Section title="1. Introduction">
                    Cette politique explique comment nous collectons, utilisons, partageons et protégeons vos données personnelles lorsque vous utilisez notre application de commande de course.
                </Section>

                <Section title="2. Données collectées">
                    • Données d'identité : nom, prénom, numéro de téléphone{'\n'}
                    {/* • Données d’utilisation : dons publiés, demandes faites, interactions entre utilisateurs{'\n'} */}
                    • Données techniques : type d'appareil, système d'exploitation, adresse IP
                </Section>

                <Section title="3. Utilisation des données">
                    Vos données sont utilisées pour :{'\n'}
                    • Créer et gérer votre compte utilisateur{'\n'}
                    • Faciliter les échanges entre utilisateurs (client, conducteur){'\n'}
                    • Améliorer le service, détecter les abus et assurer la sécurité
                </Section>

                <Section title="4. Partage des données">
                    Vos données ne sont pas vendues. Elles peuvent être partagées avec :{'\n'}
                    • Des prestataires de services techniques (hébergement, notifications){'\n'}
                    • Des autorités légales si la loi l’exige
                </Section>

                <Section title="5. Sécurité des données">
                    Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données contre tout accès non autorisé, altération ou destruction.
                </Section>

                <Section title="6. Durée de conservation">
                    Vos données sont conservées aussi longtemps que nécessaire pour les finalités définies, ou jusqu’à la suppression de votre compte.
                </Section>

                <Section title="7. Vos droits">
                    Vous disposez de droits sur vos données : accès, rectification, suppression, opposition. Contactez-nous pour exercer vos droits.
                </Section>

                <Section title="8. Cookies et technologies similaires">
                    Notre application peut utiliser des technologies de suivi anonymes pour améliorer l'expérience utilisateur. Aucun cookie tiers n’est utilisé à des fins publicitaires.
                </Section>

                <Section title="9. Modifications">
                    Nous pouvons modifier cette politique. Vous serez informé de toute mise à jour importante via l’application.
                </Section>

                <Text className="text-sm text-gray-500 mt-6 font-['RubikRegular']">
                    Pour toute question ou demande relative à vos données personnelles, contactez-nous depuis la section « Contact » de l’application.
                </Text>
            </ScrollView>
        </View>
    )
}