/**
 * Seed data for Heidelberg places
 *
 * Real places worth visiting in Heidelberg, Germany
 */

import { HeidelbergPlaceAttributes } from './model';

type SeedPlace = Omit<HeidelbergPlaceAttributes, 'ID' | 'CreatedAt' | 'UpdatedAt'>;

export const heidelbergPlaces: SeedPlace[] = [
  // Castles & Historic Buildings
  {
    Name: 'Heidelberg Castle',
    Description:
      'One of Germany\'s most famous castle ruins, overlooking the old town. The castle combines Gothic and Renaissance architecture and houses the world\'s largest wine barrel (Großes Fass).',
    Category: 'Castle',
    Address: 'Schlosshof 1, 69117 Heidelberg',
    Latitude: 49.4105,
    Longitude: 8.7153,
    OpeningHours: 'Daily 8:00-18:00 (summer), 8:00-17:00 (winter)',
    EntryFee: 9.0,
    Website: 'https://www.schloss-heidelberg.de',
    Rating: 4.7,
    IsAccessible: false,
  },
  {
    Name: 'Karl Theodor Bridge (Alte Brücke)',
    Description:
      'Historic stone bridge built in 1788, offering stunning views of the castle and old town. Features the famous Bridge Gate and monkey statue.',
    Category: 'Historic Site',
    Address: 'Alte Brücke, 69117 Heidelberg',
    Latitude: 49.4133,
    Longitude: 8.7107,
    OpeningHours: 'Always open',
    EntryFee: null,
    Website: null,
    Rating: 4.8,
    IsAccessible: true,
  },

  // Churches
  {
    Name: 'Church of the Holy Spirit',
    Description:
      'Gothic church in the heart of the old town marketplace, built between 1398-1515. Former burial place of the Electors of the Palatinate.',
    Category: 'Church',
    Address: 'Marktplatz, 69117 Heidelberg',
    Latitude: 49.4118,
    Longitude: 8.7095,
    OpeningHours: 'Mon-Sat 11:00-17:00, Sun 12:30-17:00',
    EntryFee: null,
    Website: 'https://www.heiliggeistkirche.de',
    Rating: 4.5,
    IsAccessible: true,
  },
  {
    Name: 'Jesuit Church',
    Description:
      'Baroque church built 1712-1759, featuring impressive interior with frescoes and the Museum of Sacred Art.',
    Category: 'Church',
    Address: 'Schulgasse 4, 69117 Heidelberg',
    Latitude: 49.4107,
    Longitude: 8.7069,
    OpeningHours: 'Daily 9:00-18:00',
    EntryFee: null,
    Website: null,
    Rating: 4.3,
    IsAccessible: true,
  },

  // Museums
  {
    Name: 'German Pharmacy Museum',
    Description:
      'Located inside Heidelberg Castle, showcasing the history of pharmacy from ancient times to the 20th century.',
    Category: 'Museum',
    Address: 'Schlosshof 1, 69117 Heidelberg',
    Latitude: 49.4102,
    Longitude: 8.7148,
    OpeningHours: 'Daily 10:00-18:00 (summer), 10:00-17:30 (winter)',
    EntryFee: null, // Included in castle ticket
    Website: 'https://www.deutsches-apotheken-museum.de',
    Rating: 4.2,
    IsAccessible: false,
  },
  {
    Name: 'Kurpfälzisches Museum',
    Description:
      'Regional museum covering art and history of the Palatinate region, including the famous Tilman Riemenschneider altar.',
    Category: 'Museum',
    Address: 'Hauptstraße 97, 69117 Heidelberg',
    Latitude: 49.4106,
    Longitude: 8.7032,
    OpeningHours: 'Tue-Sun 10:00-18:00',
    EntryFee: 3.0,
    Website: 'https://www.museum-heidelberg.de',
    Rating: 4.1,
    IsAccessible: true,
  },
  {
    Name: 'Student Prison (Studentenkarzer)',
    Description:
      'Historic university detention room used 1778-1914, covered in graffiti and inscriptions from imprisoned students.',
    Category: 'Museum',
    Address: 'Augustinergasse 2, 69117 Heidelberg',
    Latitude: 49.4108,
    Longitude: 8.7067,
    OpeningHours: 'Tue-Sun 10:00-18:00 (Apr-Oct), 10:00-16:00 (Nov-Mar)',
    EntryFee: 3.0,
    Website: null,
    Rating: 4.4,
    IsAccessible: false,
  },

  // Parks & Nature
  {
    Name: 'Philosophenweg (Philosophers\' Walk)',
    Description:
      'Famous hillside path with panoramic views of the old town, castle, and Neckar River. Named after the philosophers who walked here.',
    Category: 'Park',
    Address: 'Philosophenweg, 69120 Heidelberg',
    Latitude: 49.4162,
    Longitude: 8.7067,
    OpeningHours: 'Always open',
    EntryFee: null,
    Website: null,
    Rating: 4.8,
    IsAccessible: false,
  },
  {
    Name: 'Heidelberg Zoo',
    Description:
      'Compact zoo with over 1,100 animals from 250 species, including elephants, big cats, and a popular petting zoo.',
    Category: 'Zoo',
    Address: 'Tiergartenstraße 3, 69120 Heidelberg',
    Latitude: 49.4178,
    Longitude: 8.6655,
    OpeningHours: 'Daily 9:00-19:00 (summer), 9:00-17:00 (winter)',
    EntryFee: 11.8,
    Website: 'https://www.zoo-heidelberg.de',
    Rating: 4.4,
    IsAccessible: true,
  },
  {
    Name: 'Thingsstätte',
    Description:
      'Open-air amphitheatre built in 1935 on Heiligenberg hill, now used for concerts. Surrounded by forest with hiking trails.',
    Category: 'Historic Site',
    Address: 'Heiligenberg, 69121 Heidelberg',
    Latitude: 49.4247,
    Longitude: 8.7019,
    OpeningHours: 'Always open',
    EntryFee: null,
    Website: null,
    Rating: 4.5,
    IsAccessible: false,
  },

  // Streets & Squares
  {
    Name: 'Hauptstraße (Main Street)',
    Description:
      'One of the longest pedestrian shopping streets in Europe (1.6 km), lined with baroque buildings, shops, and cafes.',
    Category: 'Street',
    Address: 'Hauptstraße, 69117 Heidelberg',
    Latitude: 49.4108,
    Longitude: 8.7030,
    OpeningHours: 'Always open (shops vary)',
    EntryFee: null,
    Website: null,
    Rating: 4.6,
    IsAccessible: true,
  },
  {
    Name: 'Marktplatz (Market Square)',
    Description:
      'Central square in the old town, surrounded by historic buildings including the Town Hall and Hercules Fountain.',
    Category: 'Square',
    Address: 'Marktplatz, 69117 Heidelberg',
    Latitude: 49.4115,
    Longitude: 8.7095,
    OpeningHours: 'Always open (market Wed & Sat mornings)',
    EntryFee: null,
    Website: null,
    Rating: 4.5,
    IsAccessible: true,
  },
  {
    Name: 'Kornmarkt',
    Description:
      'Picturesque square with the best view of the castle, featuring the Madonna statue fountain and traditional half-timbered houses.',
    Category: 'Square',
    Address: 'Kornmarkt, 69117 Heidelberg',
    Latitude: 49.4109,
    Longitude: 8.7110,
    OpeningHours: 'Always open',
    EntryFee: null,
    Website: null,
    Rating: 4.7,
    IsAccessible: true,
  },

  // University
  {
    Name: 'Heidelberg University (Old Campus)',
    Description:
      'Founded in 1386, the oldest university in Germany. The old campus features beautiful historic buildings including the Old University and the Lion Fountain.',
    Category: 'University',
    Address: 'Grabengasse 1, 69117 Heidelberg',
    Latitude: 49.4104,
    Longitude: 8.7068,
    OpeningHours: 'Grounds always open, buildings vary',
    EntryFee: null,
    Website: 'https://www.uni-heidelberg.de',
    Rating: 4.6,
    IsAccessible: true,
  },
  {
    Name: 'University Library',
    Description:
      'Historic library building with exhibitions of medieval manuscripts, including the famous Codex Manesse.',
    Category: 'Library',
    Address: 'Plöck 107-109, 69117 Heidelberg',
    Latitude: 49.4097,
    Longitude: 8.7023,
    OpeningHours: 'Mon-Fri 8:30-22:00, Sat-Sun 9:00-22:00',
    EntryFee: null,
    Website: 'https://www.ub.uni-heidelberg.de',
    Rating: 4.3,
    IsAccessible: true,
  },
];

/**
 * Seed the database with Heidelberg places
 */
export async function seedHeidelbergPlaces(model: any): Promise<void> {
  console.log('Seeding Heidelberg places...');

  for (const place of heidelbergPlaces) {
    await model.create(place);
  }

  console.log(`✓ Seeded ${heidelbergPlaces.length} places`);
}
