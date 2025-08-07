import { io, Socket } from 'socket.io-client';
import { socketUrl } from './api';

class SocketService {
    private socket: Socket | null = null;
    private static instance: SocketService;

    private constructor() { }

    static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    connect(userId: string, token: string){
        if (this.socket) return; // Éviter plusieurs connexions

        // const token = useStore().tok;
        this.socket = io(socketUrl, {
            // auth: { token },
            extraHeaders: {
                access_token: token || "",
            },
            reconnection: true, // Permet la reconnexion automatique
            reconnectionAttempts: 5, // Nombre de tentatives de reconnexion
            reconnectionDelay: 2000, // Délai entre chaque tentative
        });

        this.socket.on('connect', () => {
            // console.log('✅ Connecté au serveur Socket.IO');
            // const userId = useStore().user._id;
            if (userId) {
                // console.log('✅ User connecté ', userId);

                this.socket?.emit('user_connected', userId);
            }
        });


        this.socket.on('disconnect', (reason) => {
            console.log(`❌ Déconnecté : ${reason}`);
        });

        this.socket.on('connect_error', (error) => {
            console.error('🚨 Erreur de connexion Socket.IO :', error);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null; // Réinitialise la socket
        }
    }

    onMessage(callback: (data: any) => void) {
        this.socket?.on('receive_message', callback);
    }

    onUserStatus(callback: (data: any) => void) {
        this.socket?.on('user_status', callback);
    }

    sendMessage(data: any) {
        this.socket?.emit('sendMessage', data);
    }
}

export default SocketService.getInstance();