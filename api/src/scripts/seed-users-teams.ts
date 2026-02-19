import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import {
  UserEntity,
  UserEventPermissionEntity,
  PermissionRole,
} from "../user/entities/user.entity";
import { TeamEntity } from "../team/entities/team.entity";
import { config } from "dotenv";
import { DatabaseConfig } from "../DatabaseConfig";
import { ConfigService } from "@nestjs/config";
import { join } from "path";

config();

async function bootstrap() {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error("Please provide an eventId as the first argument");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const configService = new ConfigService();
  const databaseConfig = new DatabaseConfig(configService);
  const baseConfig = databaseConfig.getConfig(true);

  // Use a glob pattern that works with ts-node in development
  const dataSource = new DataSource({
    ...baseConfig,
    entities: [join(__dirname, "..", "**", "*.entity.ts")],
  } as DataSourceOptions);


  await dataSource.initialize();
  console.log("Database connected!");

  try {
    const userRepository = dataSource.getRepository(UserEntity);
    const teamRepository = dataSource.getRepository(TeamEntity);
    const eventRepository = dataSource.getRepository(EventEntity);
    const permissionRepository = dataSource.getRepository(
      UserEventPermissionEntity,
    );

    const event = await eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new Error(`Event with ID ${eventId} not found`);
    }

    console.log(
      `Seeding 90 users and 30 teams for event: ${event.name} (${event.id})`,
    );

    const users: UserEntity[] = [];
    const now = Date.now();
    for (let i = 1; i <= 90; i++) {
      const user = new UserEntity();
      user.githubId = `seed-user-${i}-${now}`;
      user.githubAccessToken = "dummy-token";
      user.email = `user${i}@example.com`;
      user.username = `seeduser${i}_${now.toString().slice(-5)}`;
      user.name = `Seed User ${i}`;
      user.profilePicture = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
      users.push(user);
    }

    const savedUsers = await userRepository.save(users);
    console.log(`Successfully saved 90 users`);

    // Add event permissions for these users
    const permissions = savedUsers.map((user) => {
      const perm = new UserEventPermissionEntity();
      perm.user = user;
      perm.event = event;
      perm.role = PermissionRole.USER;
      return perm;
    });
    await permissionRepository.save(permissions);
    console.log(`Successfully added event permissions for 90 users`);

    const teams: TeamEntity[] = [];
    for (let i = 1; i <= 30; i++) {
      const team = new TeamEntity();
      team.name = `Seed Team ${i}`;
      team.event = event;

      // Assign 3 users to each team
      const teamUsers = savedUsers.slice((i - 1) * 3, i * 3);
      team.users = teamUsers;
      team.repo = "https://github.com/42core-team/monorepo";
      team.startedRepoCreationAt = new Date();

      teams.push(team);
    }

    await teamRepository.save(teams);
    console.log(`Successfully saved 30 teams and assigned users`);

    console.log("Seeding completed successfully!");
  } finally {
    await dataSource.destroy();
  }
}

bootstrap().catch((err) => {
  console.error("Error seeding data:", err);
  process.exit(1);
});
