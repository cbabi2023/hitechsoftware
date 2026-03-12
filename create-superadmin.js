#!/usr/bin/env node

/**
 * Script to create a superadmin user in Supabase
 * Usage: node create-superadmin.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY>
 */

const { createClient } = require('@supabase/supabase-js');

async function createSuperAdmin() {
  // Get credentials from command line or environment
  const SUPABASE_URL = process.argv[2] || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.argv[3] || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Missing Supabase credentials');
    console.log('\nUsage:');
    console.log('  node create-superadmin.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY>');
    console.log('\nOr set environment variables:');
    console.log('  $env:SUPABASE_URL = "your-url"');
    console.log('  $env:SUPABASE_SERVICE_ROLE_KEY = "your-key"');
    process.exit(1);
  }

  try {
    // Create Supabase client with service role key (for admin operations)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🔐 Creating superadmin user...');
    console.log('   Email: Varghesejoby2003@gmail.com');
    console.log('   Role: super_admin');

    // Create user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'Varghesejoby2003@gmail.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        display_name: 'Joby Sir',
        role: 'super_admin',
      },
    });

    if (authError) {
      console.error('❌ Auth Error:', authError.message);
      process.exit(1);
    }

    const userId = authUser.user.id;
    console.log('✅ Auth user created successfully');
    console.log(`   User ID: ${userId}`);

    // Create profile record
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: 'Varghesejoby2003@gmail.com',
        display_name: 'Joby Sir',
        phone_number: '+919876543210',
        role: 'super_admin',
        is_active: true,
        is_deleted: false,
      })
      .select();

    if (profileError) {
      console.error('❌ Profile Error:', profileError.message);
      // Still successful if profile creation fails (user auth exists)
    } else {
      console.log('✅ Profile created successfully');
      console.log(`   Profile ID: ${profile[0].id}`);
    }

    // Verify user exists
    console.log('\n🔍 Verifying user...');
    const { data: users, error: verifyError } = await supabase.auth.admin.listUsers();

    if (verifyError) {
      console.error('❌ Verification Error:', verifyError.message);
      process.exit(1);
    }

    const createdUser = users.users.find((u) => u.email === 'Varghesejoby2003@gmail.com');

    if (createdUser) {
      console.log('✅ User verified in auth.users');
      console.log(`   Email: ${createdUser.email}`);
      console.log(`   User ID: ${createdUser.id}`);
      console.log(`   Email Confirmed: ${createdUser.email_confirmed_at ? 'Yes' : 'No'}`);
    } else {
      console.error('❌ User not found in verification');
      process.exit(1);
    }

    // Verify profile in database
    console.log('\n📋 Verifying profile in database...');
    const { data: profileData, error: profileVerifyError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'Varghesejoby2003@gmail.com');

    if (profileVerifyError) {
      console.error('❌ Profile Verify Error:', profileVerifyError.message);
    } else if (profileData && profileData.length > 0) {
      console.log('✅ Profile verified in database');
      console.log(`   ID: ${profileData[0].id}`);
      console.log(`   Email: ${profileData[0].email}`);
      console.log(`   Name: ${profileData[0].display_name}`);
      console.log(`   Role: ${profileData[0].role}`);
      console.log(`   Active: ${profileData[0].is_active}`);
    } else {
      console.error('❌ Profile not found in database');
    }

    console.log('\n✨ Superadmin creation complete!');
    console.log('\nLogin Credentials:');
    console.log('  Email: Varghesejoby2003@gmail.com');
    console.log('  Password: admin123');
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
