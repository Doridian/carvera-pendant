import { Server, Socket } from 'node:net';

export class ProxyProvider {
    private server?: Server;

    public constructor(private port: number, private ip: string = '127.0.0.1') {

    }

    private connection(socket: Socket) {
        socket.on('data', (data) => {
            console.log(data);
        });
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }

    public start() {
        this.stop();
        this.server = new Server();
        this.server.listen(this.port, this.ip);
        this.server.on('connection', (socket) => {
            this.connection(socket);
        });
    }
}
