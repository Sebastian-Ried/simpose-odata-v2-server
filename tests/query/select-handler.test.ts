/**
 * $select → Sequelize attributes
 */

import { describe, it, expect } from 'vitest';
import { buildSelect } from '../../src/query/select-handler';
import { ODataSchemaConfig } from '../../src/config/types';

const schema: ODataSchemaConfig = {
  namespace: 'Test',
  entities: {
    Graft: {
      keys: ['id'],
      properties: {
        id: { type: 'Edm.Int32', nullable: false },
        status: { type: 'Edm.String' },
        eventCount: { type: 'Edm.Int32', virtual: true },
        createdAt: { type: 'Edm.DateTime' },
        updatedAt: { type: 'Edm.DateTime' },
      },
    },
  },
} as ODataSchemaConfig;

describe('buildSelect', () => {
  it('adds the schema timestamps when no model attributes are known', () => {
    expect(buildSelect(['status'], 'Graft', schema)).toEqual(['status', 'id', 'updatedAt', 'createdAt']);
  });

  it('maps timestamps to the model attribute names (createdAt: "created_at")', () => {
    const attrs = ['id', 'status', 'created_at', 'updated_at'];
    expect(buildSelect(['status'], 'Graft', schema, attrs)).toEqual(['status', 'id', 'updated_at', 'created_at']);
  });

  it('maps an explicitly selected timestamp to the model attribute', () => {
    const attrs = ['id', 'status', 'created_at', 'updated_at'];
    expect(buildSelect(['updatedAt'], 'Graft', schema, attrs)).toEqual(['updated_at', 'id', 'created_at']);
  });

  it('never selects virtual properties', () => {
    expect(buildSelect(['eventCount'], 'Graft', schema, ['id', 'createdAt', 'updatedAt']))
      .toEqual(['id', 'updatedAt', 'createdAt']);
  });
});
