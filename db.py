import os
import json
from typing import Dict, Any, List, Optional

MONGO_URI = os.environ.get("MONGO_URI", "")
DB_NAME = os.environ.get("DB_NAME", "isro_burnin")

_mongo_client = None
_use_fallback = False

class FallbackCollection:
    def __init__(self, name: str):
        self.name = name
        self.data_file = os.path.join(os.path.dirname(__file__), f"{name}_store.json")
        self.docs = self._load()

    def _load(self) -> List[Dict[str, Any]]:
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def _save(self):
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(self.docs, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save fallback db {self.name}: {e}")

    def create_index(self, key: str, unique: bool = False):
        pass

    def delete_many(self, filter_query: Optional[Dict[str, Any]] = None):
        if not filter_query:
            self.docs = []
        else:
            self.docs = [d for d in self.docs if not self._matches(d, filter_query)]
        self._save()

    def insert_many(self, docs: List[Dict[str, Any]]):
        self.docs.extend(docs)
        self._save()

    def insert_one(self, doc: Dict[str, Any]):
        self.docs.append(doc)
        self._save()

    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        for k, v in query.items():
            if k == "":
                if not any(self._matches(doc, subq) for subq in v):
                    return False
            elif isinstance(v, dict):
                val = doc.get(k)
                if "" in v and not (val is not None and val >= v[""]): return False
                if "" in v and not (val is not None and val <= v[""]): return False
                if "" in v and not (val is not None and val > v[""]): return False
                if "" in v and not (val is not None and val < v[""]): return False
                if "" in v and val == v[""]: return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def find_one(self, filter_query: Dict[str, Any], projection: Optional[Dict[str, int]] = None) -> Optional[Dict[str, Any]]:
        for d in self.docs:
            if self._matches(d, filter_query):
                res = dict(d)
                if projection and "_id" in projection and projection["_id"] == 0:
                    res.pop("_id", None)
                return res
        return None

    def find(self, filter_query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, int]] = None):
        res = []
        for d in self.docs:
            if filter_query is None or self._matches(d, filter_query):
                item = dict(d)
                if projection and "_id" in projection and projection["_id"] == 0:
                    item.pop("_id", None)
                res.append(item)
        
        class Cursor:
            def __init__(self, items):
                self.items = items
            def limit(self, n: int):
                self.items = self.items[:n]
                return self
            def __iter__(self):
                return iter(self.items)
            def __list__(self):
                return self.items

        return Cursor(res)

    def count_documents(self, filter_query: Dict[str, Any]) -> int:
        return sum(1 for d in self.docs if self._matches(d, filter_query))

    def distinct(self, key: str) -> List[Any]:
        seen = []
        for d in self.docs:
            val = d.get(key)
            if val is not None and val not in seen:
                seen.append(val)
        return seen

def get_client():
    global _mongo_client, _use_fallback
    if _use_fallback:
        return None
    if _mongo_client is None:
        if not MONGO_URI:
            _use_fallback = True
            return None
        try:
            from pymongo import MongoClient
            from pymongo.server_api import ServerApi
            client = MongoClient(MONGO_URI, server_api=ServerApi("1"), serverSelectionTimeoutMS=2000)
            client.admin.command('ping')
            _mongo_client = client
            print("[DB] Connected successfully to MongoDB Atlas.")
        except Exception as e:
            print(f"[DB] MongoDB Atlas not reachable ({e}). Switching to local persistent storage.")
            _use_fallback = True
            return None
    return _mongo_client

def get_components_collection():
    client = get_client()
    if client is not None and not _use_fallback:
        return client[DB_NAME]["components"]
    return FallbackCollection("components")

def get_runs_collection():
    client = get_client()
    if client is not None and not _use_fallback:
        return client[DB_NAME]["runs"]
    return FallbackCollection("runs")

def ensure_indexes():
    client = get_client()
    if client is not None and not _use_fallback:
        try:
            comps = client[DB_NAME]["components"]
            comps.create_index("component_id", unique=True)
            comps.create_index("vehicle")
            comps.create_index("lot_id")
            comps.create_index("final_flag")
        except Exception:
            pass
