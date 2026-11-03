export type CountryPreset = {
  code: string
  name: string
  currency: string
  prefix: string
  cities: string[]
}

export const COUNTRIES: CountryPreset[] = [
  { code: 'TG', name: 'Togo', currency: 'XOF', prefix: '+228', cities: ['Lomé', 'Kara', 'Sokodé', 'Kpalimé', 'Atakpamé', 'Tsévié', 'Aného', 'Dapaong'] },
  { code: 'BJ', name: 'Bénin', currency: 'XOF', prefix: '+229', cities: ['Cotonou', 'Porto-Novo', 'Abomey-Calavi', 'Parakou', 'Bohicon', 'Ouidah'] },
  { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', prefix: '+225', cities: ['Abidjan', 'Bouaké', 'Yamoussoukro', 'San-Pédro', 'Daloa', 'Korhogo'] },
  { code: 'SN', name: 'Sénégal', currency: 'XOF', prefix: '+221', cities: ['Dakar', 'Thiès', 'Touba', 'Saint-Louis', 'Kaolack', 'Ziguinchor'] },
  { code: 'ML', name: 'Mali', currency: 'XOF', prefix: '+223', cities: ['Bamako', 'Sikasso', 'Ségou', 'Kayes', 'Mopti'] },
  { code: 'BF', name: 'Burkina Faso', currency: 'XOF', prefix: '+226', cities: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou'] },
  { code: 'NE', name: 'Niger', currency: 'XOF', prefix: '+227', cities: ['Niamey', 'Zinder', 'Maradi', 'Tahoua'] },
  { code: 'GN', name: 'Guinée', currency: 'GNF', prefix: '+224', cities: ['Conakry', 'Kaloum', 'Dixinn', 'Matam', 'Matoto', 'Ratoma', 'Coyah', 'Dubréka', 'Forécariah', 'Kindia', 'Télimélé', 'Mamou', 'Dalaba', 'Pita', 'Labé', 'Lélouma', 'Mali', 'Koubia', 'Tougué', 'Boké', 'Boffa', 'Fria', 'Gaoual', 'Koundara', 'Kankan', 'Kérouané', 'Kouroussa', 'Mandiana', 'Siguiri', 'Faranah', 'Dabola', 'Dinguiraye', 'Kissidougou', 'Nzérékoré', 'Beyla', 'Guéckédou', 'Lola', 'Macenta', 'Yomou'] },
  { code: 'CM', name: 'Cameroun', currency: 'XAF', prefix: '+237', cities: ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Bamenda'] },
  { code: 'GA', name: 'Gabon', currency: 'XAF', prefix: '+241', cities: ['Libreville', 'Port-Gentil', 'Franceville'] },
  { code: 'CG', name: 'Congo', currency: 'XAF', prefix: '+242', cities: ['Brazzaville', 'Pointe-Noire'] },
  { code: 'TD', name: 'Tchad', currency: 'XAF', prefix: '+235', cities: ["N'Djamena", 'Moundou'] },
  { code: 'CD', name: 'RD Congo', currency: 'CDF', prefix: '+243', cities: ['Kinshasa', 'Lubumbashi', 'Goma', 'Mbuji-Mayi'] },
  { code: 'GH', name: 'Ghana', currency: 'GHS', prefix: '+233', cities: ['Accra', 'Kumasi', 'Tamale', 'Takoradi'] },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', prefix: '+234', cities: ['Lagos', 'Abuja', 'Port Harcourt', 'Kano'] },
  { code: 'MA', name: 'Maroc', currency: 'MAD', prefix: '+212', cities: ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès'] },
  { code: 'FR', name: 'France', currency: 'EUR', prefix: '+33', cities: [] },
  { code: 'BE', name: 'Belgique', currency: 'EUR', prefix: '+32', cities: [] },
]

export function findCountry(code: string | null | undefined) {
  return COUNTRIES.find((c) => c.code === code?.toUpperCase())
}
