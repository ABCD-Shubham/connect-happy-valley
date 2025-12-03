import os
import re
from flask import Flask, jsonify, send_from_directory
from pinecone import Pinecone

app = Flask(__name__, static_folder='.')

# Pinecone configuration
PINECONE_API_KEY = "pcsk_6tHWnQ_UNeVU3sQFeRbjzsMiVcC3FrGKN4gtJxVkMeXy89uJm5LFftdZ5ZLL7sV24hCcBD"
PINECONE_INDEX_NAME = "connect-happy-valley"

def parse_restaurant_text(text):
    restaurants = []
    # Split by the separator line
    chunks = re.split(r'_{10,}', text)
    
    for chunk in chunks:
        if not chunk.strip():
            continue
            
        lines = [l.strip() for l in chunk.split('\n') if l.strip()]
        if not lines:
            continue
            
        restaurant = {}
        
        # Try to extract data using regex patterns based on the file format
        
        # Name is usually the first line or part of it
        # The format in Data.txt is a bit unstructured in the first line, e.g.:
        # "Allen Street Grill           100 W College Ave... "
        # But sometimes it's split.
        
        # Let's try to find specific fields
        
        # Description
        desc_match = re.search(r'Description\s*(?:-->|:)\s*(.+)', chunk, re.IGNORECASE | re.DOTALL)
        if desc_match:
            # Take the first paragraph of description
            desc_full = desc_match.group(1).strip()
            restaurant['description'] = desc_full.split('\n')[0]
        else:
            # Fallback for description if not explicitly marked
            restaurant['description'] = "No description available."

        # Ratings and Pricing
        rating_match = re.search(r'Ratings?\s*(?:-->|→)\s*([\d.~]+\s*Stars?)', chunk, re.IGNORECASE)
        pricing_match = re.search(r'Pricings?\s*(?:-->|→)\s*([$0-9–to\s]+)', chunk, re.IGNORECASE)
        
        restaurant['rating'] = rating_match.group(1).strip() if rating_match else "N/A"
        restaurant['pricing'] = pricing_match.group(1).strip() if pricing_match else "N/A"
        
        # Name
        # We can try to extract the name from the "Description -->" line if it exists, e.g. "Allen Street Grill Description -->"
        name_from_desc = re.search(r'^(.+?)\s+Description', chunk, re.MULTILINE)
        if name_from_desc:
            restaurant['name'] = name_from_desc.group(1).strip()
        else:
            # Fallback: first line, take first few words? 
            # Or look for the line before "Restaurant Location"
            # In Data.txt, the first line often contains Name, Location, Schedule, Contact all together
            # But later entries have "Restaurant Location:" explicitly.
            
            # Let's try to find "Restaurant Name"
            name_match = re.search(r'Restaurant Name\s*(.+)', chunk)
            if name_match:
                restaurant['name'] = name_match.group(1).strip()
            else:
                # Use the first line as name if it's short, otherwise it's tricky
                first_line = lines[0]
                # If first line has multiple spaces, it might be the header row
                if "Restaurant Name" in first_line and "Restaurant Location" in first_line:
                    continue # Skip header chunk
                
                # Heuristic: Name is usually at the start
                # For "Allen Street Grill 100 W College...", we can't easily split without known delimiters
                # But later entries like "The Waffle Shop Downtown" are on their own line
                restaurant['name'] = first_line

        # Location
        loc_match = re.search(r'Restaurant Location(?:\s*:)?\s*(.+)', chunk, re.IGNORECASE)
        if loc_match:
            restaurant['location'] = loc_match.group(1).strip()
        else:
            # Try to find address pattern in the first chunk
            # This is hard to do reliably without more structure
            restaurant['location'] = "Location details inside"

        # Schedule
        sched_match = re.search(r'Restaurant Time Schedule(?:\s*:)?\s*(.+)', chunk, re.IGNORECASE)
        if sched_match:
            restaurant['schedule'] = sched_match.group(1).strip()
        else:
            restaurant['schedule'] = "Check details"

        # Contact
        contact_match = re.search(r'Contact Info(?:\s*:)?\s*(.+)', chunk, re.IGNORECASE)
        if contact_match:
            restaurant['contact'] = contact_match.group(1).strip()
        else:
            restaurant['contact'] = "Check details"
            
        # Clean up name if it contains other fields (for the first few unstructured entries)
        if restaurant.get('name') and len(restaurant['name']) > 50:
             # It probably captured the whole line. 
             # For the first few entries, the format is "Name   Location   Schedule"
             parts = re.split(r'\s{2,}', restaurant['name'])
             if len(parts) > 0:
                 restaurant['name'] = parts[0]
             if len(parts) > 1 and restaurant['location'] == "Location details inside":
                 restaurant['location'] = parts[1]
             if len(parts) > 2 and restaurant['schedule'] == "Check details":
                 restaurant['schedule'] = parts[2]

        if restaurant.get('name'):
            restaurants.append(restaurant)
            
    return restaurants

@app.route('/')
def index_page():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/restaurants')
def get_restaurants():
    try:
        # Initialize Pinecone connection
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX_NAME)
        
        # The data is in namespace 'Connnect Happy Valley' with ID 'connect.happy.valley'
        namespace = 'Connnect Happy Valley'
        vector_id = 'connect.happy.valley'
        
        # Fetch data from Pinecone
        response = index.fetch(ids=[vector_id], namespace=namespace)
        
        if not response or vector_id not in response.vectors:
            return jsonify({"error": "Data not found in Pinecone"}), 404
            
        record = response.vectors[vector_id]
        
        # The restaurant data is in metadata, with each restaurant name as a key
        # containing an array of strings that need to be joined and parsed
        restaurants = []
        
        if record.metadata:
            for restaurant_name, data_array in record.metadata.items():
                if restaurant_name == 'code':  # Skip the 'code' key
                    continue
                    
                # Join the array elements to form a complete JSON-like string
                restaurant_str = ''.join(data_array)
                
                try:
                    # Parse the restaurant data
                    # The format is like: "{\n    name: 'Federal TapHouse'\n    location: '...'\n    ...}"
                    # We need to convert this to proper JSON or parse it manually
                    
                    restaurant_dict = {}
                    lines = restaurant_str.split('\n')
                    
                    for line in lines:
                        line = line.strip()
                        if ':' in line:
                            # Remove leading/trailing braces and quotes
                            line = line.strip('{}').strip()
                            
                            # Split on first colon
                            parts = line.split(':', 1)
                            if len(parts) == 2:
                                key = parts[0].strip()
                                value = parts[1].strip().strip("'\"").rstrip(',').strip("'\"")
                                restaurant_dict[key] = value
                    
                    if restaurant_dict.get('name'):
                        restaurants.append(restaurant_dict)
                        
                except Exception as e:
                    print(f"Error parsing restaurant {restaurant_name}: {e}")
                    continue
        
        return jsonify(restaurants)
        
    except Exception as e:
        print(f"Error fetching from Pinecone: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting server on http://localhost:3000")
    app.run(port=3000)
