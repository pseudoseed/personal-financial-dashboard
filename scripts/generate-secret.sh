#!/bin/bash

# Generate NEXTAUTH_SECRET for the financial dashboard
echo "Generating NEXTAUTH_SECRET..."

# Generate a secure random secret
SECRET=$(openssl rand -base64 32)

echo "Generated NEXTAUTH_SECRET:"
echo "$SECRET"
echo ""
echo "Add this to your .env file:"
echo "NEXTAUTH_SECRET=\"$SECRET\""
echo ""
echo "Example .env entry:"
echo "NEXTAUTH_SECRET=\"$SECRET\"" 