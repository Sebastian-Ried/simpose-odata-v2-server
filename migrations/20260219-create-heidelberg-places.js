'use strict';

/**
 * Migration: Create HeidelbergPlace table
 *
 * This table stores interesting places to visit in Heidelberg, Germany.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HeidelbergPlaces', {
      ID: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      Name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Name of the place',
      },
      Description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Detailed description of the place',
      },
      Category: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Category: Castle, Church, Museum, Park, Street, etc.',
      },
      Address: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Street address',
      },
      Latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'GPS latitude coordinate',
      },
      Longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'GPS longitude coordinate',
      },
      OpeningHours: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Opening hours info',
      },
      EntryFee: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: true,
        comment: 'Entry fee in EUR (null if free)',
      },
      Website: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Official website URL',
      },
      Rating: {
        type: Sequelize.DECIMAL(2, 1),
        allowNull: true,
        comment: 'Average rating 1.0-5.0',
      },
      IsAccessible: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Wheelchair accessible',
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      UpdatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add index on Category for faster filtering
    await queryInterface.addIndex('HeidelbergPlaces', ['Category'], {
      name: 'idx_heidelberg_places_category',
    });

    // Add index on Rating for sorting
    await queryInterface.addIndex('HeidelbergPlaces', ['Rating'], {
      name: 'idx_heidelberg_places_rating',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('HeidelbergPlaces');
  },
};
