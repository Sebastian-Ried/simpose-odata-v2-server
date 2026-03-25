/**
 * Type Mapping Tests
 *
 * Tests for EDM <-> Sequelize type conversions
 */

import { describe, it, expect } from 'vitest';
import { DataTypes } from 'sequelize';
import {
  sequelizeToEdmType,
  edmToSequelizeType,
  valueToODataLiteral,
  odataLiteralToValue,
} from '../../src/metadata/type-mapping';

describe('Type Mapping', () => {
  describe('sequelizeToEdmType', () => {
    it('should map INTEGER to Edm.Int32', () => {
      expect(sequelizeToEdmType(DataTypes.INTEGER)).toBe('Edm.Int32');
    });

    it('should map BIGINT to Edm.Int64', () => {
      expect(sequelizeToEdmType(DataTypes.BIGINT)).toBe('Edm.Int64');
    });

    it('should map STRING to Edm.String', () => {
      expect(sequelizeToEdmType(DataTypes.STRING)).toBe('Edm.String');
    });

    it('should map TEXT to Edm.String', () => {
      expect(sequelizeToEdmType(DataTypes.TEXT)).toBe('Edm.String');
    });

    it('should map BOOLEAN to Edm.Boolean', () => {
      expect(sequelizeToEdmType(DataTypes.BOOLEAN)).toBe('Edm.Boolean');
    });

    it('should map DATE to Edm.DateTime', () => {
      expect(sequelizeToEdmType(DataTypes.DATE)).toBe('Edm.DateTime');
    });

    it('should map DATEONLY to Edm.DateTime', () => {
      expect(sequelizeToEdmType(DataTypes.DATEONLY)).toBe('Edm.DateTime');
    });

    it('should map DECIMAL to Edm.Decimal', () => {
      expect(sequelizeToEdmType(DataTypes.DECIMAL)).toBe('Edm.Decimal');
    });

    it('should map FLOAT to Edm.Single', () => {
      expect(sequelizeToEdmType(DataTypes.FLOAT)).toBe('Edm.Single');
    });

    it('should map DOUBLE to Edm.Double', () => {
      expect(sequelizeToEdmType(DataTypes.DOUBLE)).toBe('Edm.Double');
    });

    it('should map BLOB to Edm.Binary', () => {
      expect(sequelizeToEdmType(DataTypes.BLOB)).toBe('Edm.Binary');
    });

    it('should map UUID to Edm.Guid', () => {
      expect(sequelizeToEdmType(DataTypes.UUID)).toBe('Edm.Guid');
    });

    it('should map TIME to Edm.Time', () => {
      expect(sequelizeToEdmType(DataTypes.TIME)).toBe('Edm.Time');
    });

    it('should default to Edm.String for unknown types', () => {
      expect(sequelizeToEdmType({} as any)).toBe('Edm.String');
    });
  });

  describe('edmToSequelizeType', () => {
    it('should map Edm.Int32 to INTEGER', () => {
      const result = edmToSequelizeType('Edm.Int32');
      expect(result.key).toBe('INTEGER');
    });

    it('should map Edm.Int64 to BIGINT', () => {
      const result = edmToSequelizeType('Edm.Int64');
      expect(result.key).toBe('BIGINT');
    });

    it('should map Edm.String to STRING', () => {
      const result = edmToSequelizeType('Edm.String');
      expect(result.key).toBe('STRING');
    });

    it('should map Edm.Boolean to BOOLEAN', () => {
      const result = edmToSequelizeType('Edm.Boolean');
      expect(result.key).toBe('BOOLEAN');
    });

    it('should map Edm.DateTime to DATE', () => {
      const result = edmToSequelizeType('Edm.DateTime');
      expect(result.key).toBe('DATE');
    });

    it('should map Edm.Decimal to DECIMAL', () => {
      const result = edmToSequelizeType('Edm.Decimal');
      expect(result.key).toBe('DECIMAL');
    });

    it('should map Edm.Double to DOUBLE', () => {
      const result = edmToSequelizeType('Edm.Double');
      expect(result.key).toBe('DOUBLE PRECISION');
    });

    it('should map Edm.Binary to BLOB', () => {
      const result = edmToSequelizeType('Edm.Binary');
      expect(result.key).toBe('BLOB');
    });

    it('should map Edm.Guid to UUID', () => {
      const result = edmToSequelizeType('Edm.Guid');
      expect(result.key).toBe('UUID');
    });
  });

  describe('valueToODataLiteral', () => {
    it('should format string with quotes', () => {
      expect(valueToODataLiteral('hello', 'Edm.String')).toBe("'hello'");
    });

    it('should escape quotes in string', () => {
      expect(valueToODataLiteral("it's", 'Edm.String')).toBe("'it''s'");
    });

    it('should format integer', () => {
      expect(valueToODataLiteral(42, 'Edm.Int32')).toBe('42');
    });

    it('should format Int64 with L suffix', () => {
      expect(valueToODataLiteral(9999999999, 'Edm.Int64')).toBe('9999999999L');
    });

    it('should format decimal with M suffix', () => {
      expect(valueToODataLiteral(99.99, 'Edm.Decimal')).toBe('99.99M');
    });

    it('should format boolean', () => {
      expect(valueToODataLiteral(true, 'Edm.Boolean')).toBe('true');
      expect(valueToODataLiteral(false, 'Edm.Boolean')).toBe('false');
    });

    it('should format null', () => {
      expect(valueToODataLiteral(null, 'Edm.String')).toBe('null');
    });

    it('should format datetime', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = valueToODataLiteral(date, 'Edm.DateTime');
      expect(result).toMatch(/^datetime'.+'$/);
    });

    it('should format guid', () => {
      const guid = '12345678-1234-1234-1234-123456789012';
      expect(valueToODataLiteral(guid, 'Edm.Guid')).toBe(`guid'${guid}'`);
    });
  });

  describe('odataLiteralToValue', () => {
    it('should parse string literal', () => {
      expect(odataLiteralToValue("'hello'")).toBe('hello');
    });

    it('should parse escaped quotes', () => {
      expect(odataLiteralToValue("'it''s'")).toBe("it's");
    });

    it('should parse integer', () => {
      expect(odataLiteralToValue('42')).toBe(42);
    });

    it('should parse negative integer', () => {
      expect(odataLiteralToValue('-10')).toBe(-10);
    });

    it('should parse decimal with suffix', () => {
      expect(odataLiteralToValue('99.99M')).toBe(99.99);
    });

    it('should parse Int64 with suffix', () => {
      // Int64 returns BigInt for large numbers
      expect(odataLiteralToValue('9999999999L')).toBe(9999999999n);
    });

    it('should parse boolean true', () => {
      expect(odataLiteralToValue('true')).toBe(true);
    });

    it('should parse boolean false', () => {
      expect(odataLiteralToValue('false')).toBe(false);
    });

    it('should parse null', () => {
      expect(odataLiteralToValue('null')).toBe(null);
    });

    it('should parse datetime literal', () => {
      const result = odataLiteralToValue("datetime'2024-01-15T10:30:00'");
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse guid literal', () => {
      const guid = '12345678-1234-1234-1234-123456789012';
      expect(odataLiteralToValue(`guid'${guid}'`)).toBe(guid);
    });

    it('should parse double', () => {
      expect(odataLiteralToValue('3.14')).toBe(3.14);
    });
  });
});
