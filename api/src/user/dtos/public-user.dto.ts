import { ApiProperty } from "@nestjs/swagger";
import { Exclude, Expose, plainToInstance } from "class-transformer";

export class MediaImageDto {
  @ApiProperty()
  @Expose()
  small: string;

  @ApiProperty()
  @Expose()
  large: string;
}

/**
 * User fields that are safe to show to other users. Allow-list: any field
 * not marked with @Expose (e.g. email, githubId) is dropped.
 */
@Exclude()
export class PublicUserDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  username: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty({ nullable: true })
  @Expose()
  profilePicture: string;

  @ApiProperty({ type: MediaImageDto, nullable: true })
  @Expose()
  picture: MediaImageDto | null;
}

export function toPublicUser(user: object): PublicUserDto {
  return plainToInstance(PublicUserDto, user, {
    excludeExtraneousValues: true,
  });
}

export function toPublicUsers(users: object[]): PublicUserDto[] {
  return users.map(toPublicUser);
}
