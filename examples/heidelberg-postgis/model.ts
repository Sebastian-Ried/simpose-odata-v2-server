/**
 * HeidelbergPlace Model for PostGIS
 *
 * Represents interesting places to visit in Heidelberg, Germany.
 * Stores coordinates as PostGIS GEOMETRY in EPSG:25832 (UTM zone 32N).
 */

import { DataTypes, Model, Sequelize, ModelStatic } from 'sequelize';

/**
 * TypeScript interface for HeidelbergPlace attributes
 */
export interface HeidelbergPlaceAttributes {
  ID: number;
  Name: string;
  Description?: string | null;
  Category: string;
  Address?: string | null;
  // PostGIS geometry stored in EPSG:25832 (UTM zone 32N)
  Location: unknown;
  // Virtual properties for OData output (computed from Location, EPSG:4326)
  Latitude?: number | null;
  Longitude?: number | null;
  OpeningHours?: string | null;
  EntryFee?: number | null;
  Website?: string | null;
  Rating?: number | null;
  IsAccessible: boolean;
  CreatedAt?: Date;
  UpdatedAt?: Date;
}

/**
 * HeidelbergPlace model class
 */
export class HeidelbergPlace
  extends Model<HeidelbergPlaceAttributes>
  implements HeidelbergPlaceAttributes
{
  declare ID: number;
  declare Name: string;
  declare Description: string | null | undefined;
  declare Category: string;
  declare Address: string | null | undefined;
  declare Location: unknown;
  declare Latitude: number | null | undefined;
  declare Longitude: number | null | undefined;
  declare OpeningHours: string | null | undefined;
  declare EntryFee: number | null | undefined;
  declare Website: string | null | undefined;
  declare Rating: number | null | undefined;
  declare IsAccessible: boolean;
  declare CreatedAt: Date | undefined;
  declare UpdatedAt: Date | undefined;
}

/**
 * Initialize the HeidelbergPlace model
 *
 * @param sequelize - Sequelize instance
 * @returns Initialized model
 */
export function initHeidelbergPlace(
  sequelize: Sequelize
): ModelStatic<HeidelbergPlace> {
  HeidelbergPlace.init(
    {
      ID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      Description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      Category: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      Address: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      // PostGIS GEOMETRY column stored in EPSG:25832 (UTM zone 32N)
      Location: {
        type: DataTypes.GEOMETRY('POINT', 25832),
        allowNull: true,
      },
      // Virtual properties - not stored in DB, computed via hooks
      Latitude: {
        type: DataTypes.VIRTUAL,
        allowNull: true,
      },
      Longitude: {
        type: DataTypes.VIRTUAL,
        allowNull: true,
      },
      OpeningHours: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      EntryFee: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
      },
      Website: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      Rating: {
        type: DataTypes.DECIMAL(2, 1),
        allowNull: true,
      },
      IsAccessible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      CreatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      UpdatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'HeidelbergPlaces',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
    }
  );

  return HeidelbergPlace;
}
