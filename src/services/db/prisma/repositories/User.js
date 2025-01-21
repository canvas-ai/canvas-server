import { PrismaClient } from '@prisma/client';

class UserRepository {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(user) {
    return await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        password: user.password
      }
    });
  }

  async findByEmail(email) {
    return await this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase()
      }
    });
  }

  async findById(id) {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  async update(id, userData) {
    return await this.prisma.user.update({
      where: { id },
      data: {
        email: userData.email,
        password: userData.password,
      }
    });
  }

  async delete(id) {
    return await this.prisma.user.delete({
      where: { id }
    });
  }
}

export default UserRepository;