import geopandas as gpd

# Read a specific layer from the GeoPackage
gdf = gpd.read_file('input.file', layer='your_layer_name')

# Save as GeoJSON
gdf.to_file('output.geojson', driver='GeoJSON')
