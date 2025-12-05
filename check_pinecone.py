from pinecone import Pinecone

# Initialize Pinecone
pc = Pinecone(api_key="pcsk_6tHWnQ_UNeVU3sQFeRbjzsMiVcC3FrGKN4gtJxVkMeXy89uJm5LFftdZ5ZLL7sV24hCcBD")
index = pc.Index("connect-happy-valley")

namespace = 'Connnect Happy Valley'

print(f"Querying namespace '{namespace}' to find all vectors...")

try:
    # Query with a zero vector to get results
    query_result = index.query(
        vector=[0.0] * 2048,
        top_k=10,
        include_metadata=True,
        namespace=namespace
    )
    
    if query_result.matches:
        print(f"\n✓ Found {len(query_result.matches)} vector(s) in the namespace:\n")
        
        for i, match in enumerate(query_result.matches, 1):
            print(f"{i}. Vector ID: '{match.id}'")
            print(f"   ID repr: {repr(match.id)}")
            print(f"   ID bytes: {match.id.encode('utf-8')}")
            
            if match.metadata:
                print(f"   Metadata keys ({len(match.metadata)}): {list(match.metadata.keys())[:10]}")
                
                # Try to fetch this specific ID
                print(f"\n   Testing fetch with ID '{match.id}'...")
                try:
                    fetch_response = index.fetch(ids=[match.id], namespace=namespace)
                    if fetch_response and fetch_response.vectors:
                        print(f"   ✓ Fetch successful!")
                        
                        # Show first restaurant data
                        vec_data = fetch_response.vectors[match.id]
                        if vec_data.metadata:
                            first_key = list(vec_data.metadata.keys())[0]
                            print(f"   First metadata key: '{first_key}'")
                            print(f"   Sample data: {str(vec_data.metadata[first_key])[:200]}...")
                    else:
                        print(f"   ✗ Fetch failed - no vectors returned")
                except Exception as e:
                    print(f"   ✗ Fetch error: {e}")
            print()
    else:
        print("\n✗ No vectors found in this namespace")
        
except Exception as e:
    print(f"✗ Query error: {e}")