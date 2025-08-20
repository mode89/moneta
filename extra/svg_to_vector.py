#!/usr/bin/env python3
"""
SVG to Android VectorDrawable converter

This script parses an SVG file and converts it to Android VectorDrawable XML format.
It reads from stdin and outputs to stdout.

Usage:
    cat input.svg | python svg_to_vector.py > output.xml
"""

import sys
import xml.etree.ElementTree as ET
import re
import math


def parse_transform(transform_str):
    """Parse SVG transform attribute and return transformation matrix"""
    if not transform_str:
        return [1, 0, 0, 1, 0, 0]  # Identity matrix
    
    # Handle matrix() transform
    matrix_match = re.search(r'matrix\(([^)]+)\)', transform_str)
    if matrix_match:
        # Split by both commas and spaces, filter out empty strings
        values_str = matrix_match.group(1).replace(',', ' ')
        values = [float(x.strip()) for x in values_str.split() if x.strip()]
        if len(values) == 6:
            return values
    
    # For now, return identity matrix for other transforms
    # Could be extended to handle translate, scale, rotate, etc.
    return [1, 0, 0, 1, 0, 0]


def apply_matrix_to_ellipse(cx, cy, rx, ry, matrix):
    """Convert an ellipse with transform matrix to path data"""
    a, b, c, d, e, f = matrix
    
    # Generate points around the ellipse and transform them
    points = []
    for i in range(0, 360, 5):  # Sample every 5 degrees
        angle = math.radians(i)
        x = cx + rx * math.cos(angle)
        y = cy + ry * math.sin(angle)
        
        # Apply matrix transformation
        new_x = a * x + c * y + e
        new_y = b * x + d * y + f
        points.append((new_x, new_y))
    
    # Create path data from points
    path_data = f"M{points[0][0]:.2f},{points[0][1]:.2f}"
    for x, y in points[1:]:
        path_data += f"L{x:.2f},{y:.2f}"
    path_data += "Z"
    
    return path_data


def convert_ellipse_to_path(ellipse):
    """Convert SVG ellipse element to path data"""
    cx = float(ellipse.get('cx', 0))
    cy = float(ellipse.get('cy', 0))
    rx = float(ellipse.get('rx', 0))
    ry = float(ellipse.get('ry', 0))
    
    transform = ellipse.get('transform', '')
    matrix = parse_transform(transform)
    
    if matrix != [1, 0, 0, 1, 0, 0]:
        # Apply transformation
        return apply_matrix_to_ellipse(cx, cy, rx, ry, matrix)
    else:
        # Simple ellipse without transformation
        # Use SVG arc commands to create ellipse path
        return f"M{cx-rx},{cy}A{rx},{ry} 0 1,1 {cx+rx},{cy}A{rx},{ry} 0 1,1 {cx-rx},{cy}Z"


def extract_fill_color(style, fill_attr):
    """Extract fill color from style attribute or fill attribute"""
    fill_color = fill_attr or ''
    
    if style:
        # Parse style attribute for fill
        style_parts = style.split(';')
        for part in style_parts:
            if part.strip().startswith('fill:'):
                fill_color = part.split(':')[1].strip()
                break
    
    # Clean up the color value
    if fill_color and fill_color != 'none':
        return fill_color
    return None


def process_svg_element(element, output_paths):
    """Recursively process SVG elements and extract path information"""
    tag = element.tag
    if '}' in tag:
        tag = tag.split('}')[1]  # Remove namespace
    
    if tag == 'path':
        path_data = element.get('d', '')
        fill_color = extract_fill_color(element.get('style'), element.get('fill'))
        
        if path_data and fill_color:
            output_paths.append({
                'pathData': path_data,
                'fillColor': fill_color
            })
    
    elif tag == 'ellipse':
        path_data = convert_ellipse_to_path(element)
        fill_color = extract_fill_color(element.get('style'), element.get('fill'))
        
        if path_data and fill_color:
            output_paths.append({
                'pathData': path_data,
                'fillColor': fill_color
            })
    
    # Recursively process child elements
    for child in element:
        process_svg_element(child, output_paths)


def scale_path_data(path_data, scale_x, scale_y, offset_x=0, offset_y=0):
    """Scale path data coordinates"""
    if not path_data:
        return path_data
    
    # This is a simple scaling approach - would need more sophisticated parsing for complete accuracy
    # For now, we'll apply a general coordinate scaling
    import re
    
    def scale_number(match):
        num = float(match.group())
        if match.group(0) in path_data:
            # Determine if this is likely an x or y coordinate based on context
            # This is a simplified approach - a full parser would be more accurate
            return str(num * scale_x)  # Simplified - assuming scale_x = scale_y for uniform scaling
        return match.group()
    
    # Scale numeric values in the path data
    scaled_path = re.sub(r'-?\d+\.?\d*', lambda m: str(float(m.group()) * scale_x), path_data)
    return scaled_path


def svg_to_vector_drawable(svg_content):
    """Convert SVG content to Android VectorDrawable XML"""
    try:
        # Parse SVG
        root = ET.fromstring(svg_content)
        
        # Extract viewBox or use width/height
        viewbox = root.get('viewBox')
        if viewbox:
            viewbox_parts = viewbox.split()
            if len(viewbox_parts) >= 4:
                vb_width = float(viewbox_parts[2])
                vb_height = float(viewbox_parts[3])
            else:
                vb_width = vb_height = 100
        else:
            # Try to get width and height
            width_str = root.get('width', '100')
            height_str = root.get('height', '100')
            
            # Remove units and convert to float
            vb_width = float(re.sub(r'[^\d.]', '', width_str) or 100)
            vb_height = float(re.sub(r'[^\d.]', '', height_str) or 100)
        
        # Extract all paths
        paths = []
        process_svg_element(root, paths)
        
        # Use a more reasonable viewport size for Android VectorDrawables
        # Large viewports can cause performance issues in Android
        target_viewport = 48.0  # Use 48 instead of 2122 for better Android compatibility
        if max(vb_width, vb_height) > 100:
            # Scale down large viewports to improve Android compatibility
            scale_factor = target_viewport / max(vb_width, vb_height)
            vb_width = vb_width * scale_factor
            vb_height = vb_height * scale_factor
            
            # Scale all path data accordingly
            for path in paths:
                path['pathData'] = scale_path_data(path['pathData'], scale_factor, scale_factor)
        
        # Generate VectorDrawable XML
        lines = ['<?xml version="1.0" encoding="utf-8"?>']
        lines.append('<vector xmlns:android="http://schemas.android.com/apk/res/android"')
        lines.append('    android:width="24dp"')
        lines.append('    android:height="24dp"')
        lines.append(f'    android:viewportWidth="{vb_width:.1f}"')
        lines.append(f'    android:viewportHeight="{vb_height:.1f}">')
        lines.append('')
        
        for i, path in enumerate(paths):
            lines.append(f'    <!-- Path {i+1} -->')
            lines.append('    <path')
            lines.append(f'        android:fillColor="{path["fillColor"]}"')
            
            # Split long pathData into multiple lines for readability
            path_data = path['pathData']
            # Limit path data length to avoid Android parsing issues
            if len(path_data) > 1500:
                # For very complex paths, we might need to simplify them
                # For now, let's truncate and close properly
                path_data = path_data[:1500].rsplit(' ', 1)[0] + " Z"
            
            if len(path_data) > 80:
                lines.append('        android:pathData="')
                # Split path data into chunks
                chunk_size = 100
                for j in range(0, len(path_data), chunk_size):
                    chunk = path_data[j:j+chunk_size]
                    if j + chunk_size < len(path_data):
                        lines.append(f'            {chunk}')
                    else:
                        lines.append(f'            {chunk}"/>')
            else:
                lines.append(f'        android:pathData="{path_data}"/>')
            lines.append('')
        
        lines.append('</vector>')
        
        return '\n'.join(lines)
        
    except ET.ParseError as e:
        print(f"Error parsing SVG: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error converting SVG: {e}", file=sys.stderr)
        return None


def main():
    """Main function - reads from stdin and writes to stdout"""
    try:
        # Read SVG content from stdin
        svg_content = sys.stdin.read()
        
        if not svg_content.strip():
            print("Error: No SVG content provided", file=sys.stderr)
            sys.exit(1)
        
        # Convert to VectorDrawable
        vector_xml = svg_to_vector_drawable(svg_content)
        
        if vector_xml:
            print(vector_xml)
        else:
            sys.exit(1)
            
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()