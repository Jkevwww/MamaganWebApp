const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../db');

// Ensure the table exists for OAuth sign-in. For production, prefer migrations.
sequelize.sync();


class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    provider: {
      type: DataTypes.ENUM('google', 'github'),
      allowNull: false
    },
    providerId: {
      type: DataTypes.STRING(191),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(191),
      allowNull: true
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['provider', 'providerId'] },
      { fields: ['email'] }
    ]
  }
);

module.exports = { User };

