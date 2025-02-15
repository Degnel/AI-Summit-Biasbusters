import os
import redis
import json

REDIS_HOST = "51.15.215.207"
REDIS_PORT = 6379
REDIS_DB = 0

class RedisClient:
    def __init__(self):
        self.client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)

    def get_history(self, user_id):
        """Récupère l'historique des messages."""
        messages = self.client.lrange(f"chat:{user_id}", 0, -1)
        return [json.loads(msg) for msg in messages]

    def save_message(self, user_id, role, content):
        """Sauvegarde un message dans l'historique."""
        message = json.dumps({'role': role, 'content': content})
        self.client.rpush(f"chat:{user_id}", message)

    def set_personal_data(self, websocket, data):
        """Enregistre ou met à jour les données personnelles de l'utilisateur."""
        user_id = websocket.remote_address
        self.client.hset(f"user:{user_id}", mapping=data)

    def get_personal_data(self, websocket):
        """Récupère les données personnelles."""
        user_id = websocket.remote_address
        return self.client.hgetall(f"user:{user_id}")

    def clear_all_data(self, user_id):
        """Supprime l'historique et les données personnelles."""
        self.client.delete(f"chat:{user_id}")
        self.client.delete(f"user:{user_id}")

redis_client = RedisClient()
