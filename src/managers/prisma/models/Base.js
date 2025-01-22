import { PrismaClient } from '@prisma/client';

class BaseModel {
  static prisma = new PrismaClient();
  static fillable = [];
  static hidden = [];
  static connections = [];
  static modelName = '';

  constructor(data = {}) {
    Object.assign(this, data);
  }

  // Static Methods
  static async create(data) {
    const filteredData = this.filterData(data);
    const connectionData = this.buildConnections(data);
    
    const result = await this.prisma[this.modelName].create({
      data: {
        ...filteredData,
        ...connectionData
      },
      select: this.buildSelect()
    });

    return new this(result);
  }

  static async findById(id) {
    const result = await this.prisma[this.modelName].findUnique({
      where: { id },
      select: this.buildSelect()
    });
    return result ? new this(result) : null;
  }

  static async findMany(where = {}) {
    const results = await this.prisma[this.modelName].findMany({
      where,
      select: this.buildSelect()
    });
    return results.map(result => new this(result));
  }

  static async findUnique(where) {
    const result = await this.prisma[this.modelName].findUnique({
      where,
      select: this.buildSelect()
    });
    return result ? new this(result) : null;
  }

  static async update(id, data) {
    const filteredData = this.filterData(data);
    const connectionData = this.buildConnections(data);

    const result = await this.prisma[this.modelName].update({
      where: { id },
      data: {
        ...filteredData,
        ...connectionData
      },
      select: this.buildSelect()
    });

    return new this(result);
  }

  static async delete(id) {
    const result = await this.prisma[this.modelName].delete({
      where: { id }
    });
    return new this(result);
  }

  static async deleteMany(where) {
    const result = await this.prisma[this.modelName].deleteMany({
      where
    });
    return new this(result);
  }

  // Static Helper Methods
  static filterData(data) {
    return Object.keys(data).reduce((acc, key) => {
      if (this.fillable.includes(key)) {
        acc[key] = data[key];
      }
      return acc;
    }, {});
  }

  static buildConnections(data) {
    return Object.fromEntries(
      this.connections
        .filter(connection => data[connection])
        .map(connection => [
          connection,
          { connect: { id: data[connection] } }
        ])
    );
  }

  static buildSelect() {
    return Object.fromEntries([
      ...this.fillable
        .filter(field => !this.hidden.includes(field))
        .map(field => [field, true]),
      ...this.connections.map(connection => [connection, true])
    ]);
  }
}

export default BaseModel;