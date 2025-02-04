""" 
gets rid of dead links indexed by Obsidian-Hugo. Definitely not the most efficient thing to do, but hopefully it gets the job done. 

the index file usually at "assets/indices/linkIndex.json"

Basic idea:
- read linkIndex.json
- loop through each index entry
  - convert character encoding
  - get rid of link that don't correspond to file in "content"
"""

import json
import urllib.parse
import os
import re

INDEX_FILE = "./assets/indices/linkIndex.json"
CONTENT_FOLDER = "./content"

def decode_url_encoding(s) -> str:
  return urllib.parse.unquote(s)

def load_json(path) -> dict:
  try:
    with open(path) as f:
      data = json.load(f)
  except FileNotFoundError:
    data = {"index": {"links": {}, "backlinks": {}}, "links": []}
    with open(path, 'w') as f:
      json.dump(data, f)
  return data

def normalize_name(s) -> str:
  # Normalize the name for consistent matching
  s = s.replace(".md", "")
  s = s.lstrip("_")  # Remove leading underscore
  s = s.lstrip("/")  # Remove leading slash
  return s.lower()   # Convert to lowercase

def strip_name(s) -> str:
  # gets rid of symbols, spaces, etc.
  return (normalize_name(s)
          .replace("?", "")
          .replace("&", "")
          .replace("!", "")
          .replace(" ", "")
          .replace("-", "")
          .replace("\\", "")
          .replace("%", "")
          .replace(":", "")
          .replace("(", "")
          .replace(")", "")
          .replace("|", "")
          .replace('"', "")
          .replace("'", "")
          .replace(".", "")
          .replace(",", "")
          .replace(";", "")
          .replace("_", "")
          )

def md_file_existence_heuristic(existing_files_set, encoded_url) -> bool:
  return strip_name(encoded_url) in existing_files_set

data = load_json(INDEX_FILE)
existing_files = set([strip_name(file) for file in os.listdir(CONTENT_FOLDER)])

links_index = data["index"]["links"]
processed_data = {"index": {"links": {}, "backlinks": {}}, "links": []}

# === Remove false links ===
for key in links_index.keys():
    clean_key = normalize_name(key)
    if md_file_existence_heuristic(existing_files, clean_key):
        # Use original key format for consistency
        processed_data["index"]["links"][key] = []
        for target in links_index[key]:
            clean_target = normalize_name(target)
            if md_file_existence_heuristic(existing_files, clean_target):
                processed_data["index"]["links"][key].append(target)

# === Generate backlinks ===
for source, targets in processed_data["index"]["links"].items():
    clean_source = normalize_name(source)
    for target in targets:
        clean_target = normalize_name(target)
        if clean_target not in processed_data["index"]["backlinks"]:
            processed_data["index"]["backlinks"][clean_target] = []
        processed_data["index"]["backlinks"][clean_target].append(source)

# === Generate links list ===
for source, targets in processed_data["index"]["links"].items():
    for target in targets:
        processed_data["links"].append({
            "source": normalize_name(source),
            "target": normalize_name(target)
        })

# === Write processed data ===
with open(INDEX_FILE, "w") as f:
    json.dump(processed_data, f, indent=2)