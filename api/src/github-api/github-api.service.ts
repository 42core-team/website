import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {RabbitMqService} from "../common/rabbitmq.service";
import * as CryptoJS from "crypto-js";

@Injectable()
export class GithubApiService {
    constructor(
        private configService: ConfigService,
        private rabbitMqService: RabbitMqService,
    ) {}

    decryptSecret(encryptedSecret: string): string {
        return CryptoJS.AES.decrypt(
            encryptedSecret,
            this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
        ).toString(CryptoJS.enc.Utf8);
    }

    async removeWritePermissions(
        username: string,
        repoOwner: string,
        repoName: string,
        encryptedSecret: string,
    ) {
        await this.rabbitMqService.emit('github_service', 'remove_write_permissions', {
            username,
            repoOwner,
            repoName,
            encryptedSecret,
        })
    }

    async addUserToRepository(
        repositoryName: string,
        username: string,
        githubOrg: string,
        encryptedSecret: string,
        githubAccessToken: string,
    ) {
        await this.rabbitMqService.emit('github_service', 'add_user_to_repository', {
            repositoryName,
            username,
            githubOrg,
            encryptedSecret,
            githubAccessToken,
        })
    }

    async removeUserFromRepository(
        repositoryName: string,
        username: string,
        githubOrg: string,
        encryptedSecret: string,
    ) {
        await this.rabbitMqService.emit('github_service', 'remove_user_from_repository', {
            repositoryName,
            username,
            githubOrg,
            encryptedSecret,
        })
    }

    async deleteRepository(
        repositoryName: string,
        githubOrg: string,
        encryptedSecret: string,
    ) {
        await this.rabbitMqService.emit('github_service', 'delete_repository', {
            repositoryName,
            githubOrg,
            encryptedSecret,
        })
    }

    async createTeamRepository(
        name: string,
        teamName: string,
        username: string,
        userGithubAccessToken: string,
        githubOrg: string,
        encryptedSecret: string,
        teamId: string,
        monoRepoUrl: string,
        monoRepoVersion: string,
        myCoreBotDockerImage: string,
        visualizerDockerImage: string,
        eventId: string
    ) {
        await this.rabbitMqService.emit('github_service', 'create_team_repository', {
            name,
            teamName,
            username,
            userGithubAccessToken,
            githubOrg,
            encryptedSecret,
            teamId,
            monoRepoUrl,
            monoRepoVersion,
            myCoreBotDockerImage,
            visualizerDockerImage,
            eventId
        })
    }
}
