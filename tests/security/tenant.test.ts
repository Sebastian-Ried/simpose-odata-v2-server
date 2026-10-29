/**
 * Tenant isolation (the `tenant` middleware option): every model with the
 * tenant attribute is limited to the request's tenant — reads, $expand,
 * $filter, updates, deletes, creates, foreign keys and $links.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express, { Express } from 'express';
import { Sequelize, DataTypes, ModelStatic, Model } from 'sequelize';
import { odataMiddleware, ODataSchemaConfig, EntityHooks } from '../../src/index';
import { createTestSequelize, request } from '../setup';

const schema: ODataSchemaConfig = {
  namespace: 'TenantService',
  entities: {
    Shops: {
      model: 'Shop',
      keys: ['id'],
      properties: {
        id: { type: 'Edm.String', nullable: false },
        tenantId: { type: 'Edm.String', nullable: false },
        name: { type: 'Edm.String' },
      },
      navigationProperties: {
        items: { target: 'Items', relationship: 'Item_Shop', multiplicity: '*' },
      },
    },
    Items: {
      model: 'Item',
      // Not unique across tenants, like a barcode
      keys: ['code'],
      properties: {
        code: { type: 'Edm.String', nullable: false },
        tenantId: { type: 'Edm.String', nullable: false },
        shopId: { type: 'Edm.String' },
        name: { type: 'Edm.String' },
      },
      navigationProperties: {
        shop: { target: 'Shops', relationship: 'Item_Shop', multiplicity: '0..1' },
      },
    },
    Tenants: {
      model: 'Tenant',
      keys: ['id'],
      properties: {
        id: { type: 'Edm.String', nullable: false },
        name: { type: 'Edm.String' },
      },
    },
  },
  associations: {
    Item_Shop: {
      ends: [
        { entity: 'Items', multiplicity: '*' },
        { entity: 'Shops', multiplicity: '0..1' },
      ],
      referentialConstraint: {
        principal: { entity: 'Shops', property: 'id' },
        dependent: { entity: 'Items', property: 'shopId' },
      },
    },
  },
};

describe('Tenant isolation', () => {
  let sequelize: Sequelize;
  let Shop: ModelStatic<Model>;
  let Item: ModelStatic<Model>;
  let Tenant: ModelStatic<Model>;

  beforeAll(() => {
    sequelize = createTestSequelize();
    Tenant = sequelize.define('Tenant', {
      id: { type: DataTypes.STRING, primaryKey: true },
      name: DataTypes.STRING,
    }, { timestamps: false });
    Shop = sequelize.define('Shop', {
      id: { type: DataTypes.STRING, primaryKey: true },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      name: DataTypes.STRING,
    }, { timestamps: false });
    Item = sequelize.define('Item', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING, allowNull: false },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      shopId: DataTypes.STRING,
      name: DataTypes.STRING,
    }, { timestamps: false });
    Item.belongsTo(Shop, { foreignKey: 'shopId', as: 'shop' });
    Shop.hasMany(Item, { foreignKey: 'shopId', as: 'items' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
    await Tenant.bulkCreate([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    await Shop.bulkCreate([
      { id: 'shop-a', tenantId: 'a', name: 'Shop A' },
      { id: 'shop-b', tenantId: 'b', name: 'Shop B' },
    ]);
    await Item.bulkCreate([
      { code: 'X1', tenantId: 'a', shopId: 'shop-a', name: 'A item' },
      { code: 'X1', tenantId: 'b', shopId: 'shop-b', name: 'B item' },
      // Rows that point across tenants (as left behind by a bug elsewhere)
      { code: 'X2', tenantId: 'b', shopId: 'shop-a', name: 'B item in A shop' },
      { code: 'X3', tenantId: 'a', shopId: 'shop-b', name: 'A item in B shop' },
    ]);
  });

  function app(hooks?: Record<string, EntityHooks>): Express {
    const a = express();
    a.use('/odata', odataMiddleware({
      sequelize,
      schema,
      models: { Shop, Item, Tenant },
      hooks,
      csrf: { enabled: false },
      verboseErrors: true,
      tenant: { attribute: 'tenantId', resolve: (req) => req.headers['x-tenant'] as string | undefined },
    }));
    return a;
  }
  const as = (tenant: string) => ({ headers: { 'x-tenant': tenant } });

  it('refuses requests without a tenant (403)', async () => {
    expect((await request(app(), 'GET', '/odata/Shops')).status).toBe(403);
  });

  it('reads only rows of the tenant', async () => {
    const res = await request(app(), 'GET', '/odata/Shops', as('a'));
    expect(res.status).toBe(200);
    expect(res.body.d.results.map((s: any) => s.id)).toEqual(['shop-a']);
    expect((await request(app(), 'GET', "/odata/Shops('shop-b')", as('a'))).status).toBe(404);
    expect((await request(app(), 'GET', '/odata/Shops/$count', as('a'))).text).toBe('1');
  });

  it('limits $expand and navigation reads to the tenant', async () => {
    const shop = await request(app(), 'GET', "/odata/Shops('shop-a')?$expand=items", as('a'));
    expect(shop.body.d.items.results.map((i: any) => i.name)).toEqual(['A item']);

    const nav = await request(app(), 'GET', "/odata/Shops('shop-a')/items", as('a'));
    expect(nav.body.d.results.map((i: any) => i.name)).toEqual(['A item']);

    const item = await request(app(), 'GET', "/odata/Items?$filter=code eq 'X3'&$expand=shop", as('a'));
    expect(item.body.d.results).toHaveLength(1);
    expect(item.body.d.results[0].shop).toBeNull();
  });

  it('limits $filter joins to the tenant', async () => {
    const res = await request(app(), 'GET', "/odata/Items?$filter=shop/name eq 'Shop B'", as('a'));
    expect(res.status).toBe(200);
    expect(res.body.d.results).toHaveLength(0);
  });

  it('creates rows in the tenant; another tenant or a foreign key of another tenant is refused', async () => {
    const ok = await request(app(), 'POST', '/odata/Items', { ...as('a'), body: { code: 'N1', shopId: 'shop-a' } });
    expect(ok.status).toBe(201);
    expect(ok.body.d.tenantId).toBe('a');

    const other = await request(app(), 'POST', '/odata/Items', { ...as('a'), body: { code: 'N2', tenantId: 'b' } });
    expect(other.status).toBe(403);

    const foreign = await request(app(), 'POST', '/odata/Items', { ...as('a'), body: { code: 'N3', shopId: 'shop-b' } });
    expect(foreign.status).toBe(404);
    expect(await Item.count({ where: { code: ['N2', 'N3'] } })).toBe(0);
  });

  it('updates and deletes only the tenant\'s row, even when the key exists in another tenant', async () => {
    const merge = await request(app(), 'MERGE', "/odata/Items('X1')", { ...as('a'), body: { name: 'renamed' } });
    expect(merge.status).toBe(204);
    expect((await Item.findOne({ where: { code: 'X1', tenantId: 'b' } }))!.get('name')).toBe('B item');
    expect((await Item.findOne({ where: { code: 'X1', tenantId: 'a' } }))!.get('name')).toBe('renamed');

    expect((await request(app(), 'DELETE', "/odata/Items('X1')", as('b'))).status).toBe(204);
    expect(await Item.count({ where: { code: 'X1' } })).toBe(1);
    expect(await Item.count({ where: { code: 'X1', tenantId: 'a' } })).toBe(1);

    expect((await request(app(), 'MERGE', "/odata/Shops('shop-b')", { ...as('a'), body: { name: 'x' } })).status).toBe(404);
    expect((await request(app(), 'DELETE', "/odata/Shops('shop-b')", as('a'))).status).toBe(404);
  });

  it('refuses moving a row to another tenant or pointing it at another tenant\'s row', async () => {
    const move = await request(app(), 'MERGE', "/odata/Shops('shop-a')", { ...as('a'), body: { tenantId: 'b' } });
    expect(move.status).toBe(403);
    const fk = await request(app(), 'MERGE', "/odata/Items('X1')", { ...as('a'), body: { shopId: 'shop-b' } });
    expect(fk.status).toBe(404);
    expect((await Item.findOne({ where: { code: 'X1', tenantId: 'a' } }))!.get('shopId')).toBe('shop-a');
  });

  it('checks foreign keys declared only by a referential constraint (navigation create)', async () => {
    const saved = (Item as any).associations.shop;
    delete (Item as any).associations.shop;
    try {
      const foreign = await request(app(), 'POST', "/odata/Shops('shop-b')/items", { ...as('a'), body: { code: 'N4' } });
      expect(foreign.status).toBe(404);
      expect(await Item.count({ where: { code: 'N4' } })).toBe(0);
      const own = await request(app(), 'POST', "/odata/Shops('shop-a')/items", { ...as('a'), body: { code: 'N5' } });
      expect(own.status).toBe(201);
    } finally {
      (Item as any).associations.shop = saved;
    }
  });

  it('checks a foreign key that arrives under its schema column name', async () => {
    const items = (schema.entities.Items as any).properties;
    const saved = items.shopId;
    items.shopId = { ...saved, column: 'shop_ref' };
    try {
      const res = await request(app(), 'POST', '/odata/Items', { ...as('a'), body: { code: 'N6', shopId: 'shop-b' } });
      expect(res.status).toBe(404);
      expect(await Item.count({ where: { code: 'N6' } })).toBe(0);
    } finally {
      items.shopId = saved;
    }
  });

  it('$links never change a foreign key past the hooks or the tenant rules', async () => {
    let hookCalls = 0;
    const hooks = { Items: { beforeUpdate: async (_ctx: any, data: any) => { hookCalls++; return data; } } };
    const foreign = await request(app(hooks), 'POST', "/odata/Items('X1')/$links/shop", {
      ...as('a'), body: { uri: "Shops('shop-b')" },
    });
    expect(foreign.status).toBeGreaterThanOrEqual(400);
    const remove = await request(app(hooks), 'DELETE', "/odata/Items('X1')/$links/shop", as('a'));
    expect(remove.status).toBeGreaterThanOrEqual(400);
    expect(hookCalls).toBe(0);
    expect((await Item.findOne({ where: { code: 'X1', tenantId: 'a' } }))!.get('shopId')).toBe('shop-a');
  });

  it('refuses deep insert and drops unknown properties', async () => {
    const deep = await request(app(), 'POST', '/odata/Shops', {
      ...as('a'), body: { id: 'shop-n', items: [{ code: 'D1', tenantId: 'b' }] },
    });
    expect(deep.status).toBe(400);
    expect(await Shop.count({ where: { id: 'shop-n' } })).toBe(0);

    const unknown = await request(app(), 'POST', '/odata/Shops', { ...as('a'), body: { id: 'shop-u', bogus: 1 } });
    expect(unknown.status).toBe(201);
  });

  it('a $batch part can never choose its tenant: it gets the outer request\'s', async () => {
    const boundary = 'batch_1';
    const part = (tenant: string) => [
      `--${boundary}`,
      'Content-Type: application/http',
      'Content-Transfer-Encoding: binary',
      '',
      'GET Shops HTTP/1.1',
      `x-tenant: ${tenant}`,
      'Accept: application/json',
      '',
      '',
    ].join('\r\n');
    const body = part('b') + `--${boundary}--\r\n`;
    const send = (headers: Record<string, string>) => new Promise<string>((resolve, reject) => {
      const server = app().listen(0, () => {
        const http = require('http');
        const req = http.request({
          hostname: 'localhost', port: (server.address() as any).port, path: '/odata/$batch', method: 'POST',
          headers: { 'Content-Type': `multipart/mixed; boundary=${boundary}`, ...headers },
        }, (res: any) => {
          let data = '';
          res.on('data', (c: string) => { data += c; });
          res.on('end', () => { server.close(); resolve(data); });
        });
        req.on('error', reject);
        req.end(body);
      });
    });
    const asA = await send({ 'x-tenant': 'a' });
    expect(asA).toContain('shop-a');
    expect(asA).not.toContain('shop-b');
    const none = await send({});
    expect(none).not.toContain('shop-b');
    expect(none).toContain('403');
  });

  it('refuses a custom handler for a scoped model', () => {
    expect(() => odataMiddleware({
      sequelize, schema, models: { Shop, Item, Tenant }, csrf: { enabled: false },
      handlers: { Shops: class {} as any },
      tenant: { attribute: 'tenantId', resolve: () => 'a' },
    })).toThrow(/not allowed with tenant isolation/);
  });

  it('excluded models are not scoped and foreign keys into them are not checked', async () => {
    const Owner = sequelize.define('Owner', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      tenantId: DataTypes.STRING, // only set for some owners: a global table
      name: DataTypes.STRING,
    }, { timestamps: false });
    const Note = sequelize.define('Note', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      tenantId: { type: DataTypes.STRING, allowNull: false },
      ownerId: DataTypes.INTEGER,
    }, { timestamps: false });
    Note.belongsTo(Owner, { foreignKey: 'ownerId', as: 'owner' });
    await Owner.sync({ force: true });
    await Note.sync({ force: true });
    const owner = await Owner.create({ name: 'global user' });
    const noteSchema: ODataSchemaConfig = {
      namespace: 'Notes',
      entities: {
        Notes: { model: 'Note', keys: ['id'], properties: {
          id: { type: 'Edm.Int32', nullable: false }, tenantId: { type: 'Edm.String' }, ownerId: { type: 'Edm.Int32' },
        } },
        Owners: { model: 'Owner', keys: ['id'], properties: {
          id: { type: 'Edm.Int32', nullable: false }, tenantId: { type: 'Edm.String' }, name: { type: 'Edm.String' },
        } },
      },
    };
    const make = (exclude?: string[]) => {
      const a = express();
      a.use('/odata', odataMiddleware({
        sequelize, schema: noteSchema, models: { Note, Owner }, csrf: { enabled: false },
        tenant: { attribute: 'tenantId', resolve: (req) => req.headers['x-tenant'] as string, exclude },
      }));
      return a;
    };
    const scoped = await request(make(), 'POST', '/odata/Notes', { ...as('a'), body: { ownerId: owner.get('id') } });
    expect(scoped.status).toBe(404);
    const excluded = await request(make(['Owner']), 'POST', '/odata/Notes', { ...as('a'), body: { ownerId: owner.get('id') } });
    expect(excluded.status).toBe(201);
    const owners = await request(make(['Owner']), 'GET', '/odata/Owners', as('a'));
    expect(owners.body.d.results).toHaveLength(1);
  });

  it('leaves models without the tenant attribute unscoped', async () => {
    const res = await request(app(), 'GET', '/odata/Tenants', as('a'));
    expect(res.body.d.results).toHaveLength(2);
  });

  it('a failing beforeDelete rolls back; afterDelete runs after the commit', async () => {
    let seenAfter = -1;
    const hooks = {
      Shops: {
        beforeDelete: async (ctx: any) => {
          await Item.destroy({ where: { shopId: ctx.keys.id }, transaction: ctx.transaction });
          if (ctx.req.headers['x-fail']) throw new Error('nope');
        },
        afterDelete: async () => { seenAfter = await Shop.count({ where: { id: 'shop-a' } }); },
      },
    };
    const failed = await request(app(hooks), 'DELETE', "/odata/Shops('shop-a')", { headers: { 'x-tenant': 'a', 'x-fail': '1' } });
    expect(failed.status).toBe(500);
    expect(await Item.count({ where: { shopId: 'shop-a' } })).toBe(2);

    const ok = await request(app(hooks), 'DELETE', "/odata/Shops('shop-a')", as('a'));
    expect(ok.status).toBe(204);
    expect(seenAfter).toBe(0);
  });
});
