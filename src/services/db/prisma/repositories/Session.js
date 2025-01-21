import { PrismaClient } from '@prisma/client';

class SessionRepository {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async create(session) {
    return await this.prisma.session.create({
      data: {
        name: session.name,
        initializer: session.initializer,
        user: {
          connect: {
            id: session.userId
          }
        }
      }
    });
  }

  async update(id, data) {
    return await this.prisma.session.update({
      where: { id },
      data
    });
  }

  async delete(id) {
    return await this.prisma.session.delete({
      where: { id }
    });
  }

  async findByUserId(userId) {
    return await this.prisma.session.findMany({
      where: { userId }
    });
  }

  async findByUserIdAndName(userId, name) {
    return await this.prisma.session.findUnique({
      where: {
        userId_name: {
          userId,
          name
        }
      }
    });
  }
}

export default SessionRepository;