import {Injectable, Logger} from '@nestjs/common';
import {ClientProxy, ClientProxyFactory} from '@nestjs/microservices';
import {ConfigService} from '@nestjs/config';
import {getRabbitmqConfig} from '../main';
import {timeout} from 'rxjs/operators';
import {firstValueFrom} from 'rxjs';

@Injectable()
export class RabbitMqService {
    private readonly logger = new Logger(RabbitMqService.name);
    private clients: Map<string, ClientProxy> = new Map();

    constructor(private configService: ConfigService) {}

    private getClient(queue: string): ClientProxy {
        if (!this.clients.has(queue)) {
            const client = ClientProxyFactory.create(getRabbitmqConfig(this.configService, queue));
            this.clients.set(queue, client);
        }
        return this.clients.get(queue)!;
    }

    /**
     * Emit a message to RabbitMQ without waiting for acknowledgment (fire and forget)
     * @param queue - The queue name
     * @param pattern - The message pattern
     * @param payload - The message payload
     */
    async emit(queue: string, pattern: string, payload: any): Promise<void> {
        const client = this.getClient(queue);

        try {
            this.logger.debug(`Emitting message to ${queue} with pattern ${pattern}`, payload);
            client.emit(pattern, payload);
        } catch (error) {
            this.logger.error(`Failed to emit message to ${queue} with pattern ${pattern}`, error);
            throw new Error(`RabbitMQ communication failed: ${error.message}`);
        }
    }
}
