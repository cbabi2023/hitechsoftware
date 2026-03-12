#!/usr/bin/env node

/**
 * Script to create a superadmin user in Supabase
 * Usage: node create-superadmin.js <SUPABASE_URL> <SUPABASE_SERVICE_KEY>
 */

const { createClient } = require('@supabase/supabase-js');

const ADMIN_EMAIL = 'Varghesejoby2003@gmail.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_PROFILE = {
  display_name: 'Joby Sir',
  phone_number: '+919876543210',
  role: 'super_admin',
  is_active: true,
  is_deleted: false,
};

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

    console.log('🔐 Ensuring superadmin user exists...');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log('   Role: super_admin');

    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Auth List Error:', listError.message);
      process.exit(1);
    }

    let authUser = existingUsers.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (!authUser) {
      const { data: createdUserData, error: authError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: ADMIN_PROFILE.display_name,
          role: ADMIN_PROFILE.role,
        },
      });

      if (authError || !createdUserData.user) {
        console.error('❌ Auth Create Error:', authError?.message || 'User was not created');
        process.exit(1);
      }

      authUser = createdUserData.user;
      console.log('✅ Auth user created successfully');
    } else {
      const { data: updatedUserData, error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          ...(authUser.user_metadata || {}),
          display_name: ADMIN_PROFILE.display_name,
          role: ADMIN_PROFILE.role,
        },
      });

      if (updateError || !updatedUserData.user) {
        console.error('❌ Auth Update Error:', updateError?.message || 'User was not updated');
        process.exit(1);
      }

      authUser = updatedUserData.user;
      console.log('✅ Auth user already existed; credentials and metadata refreshed');
    }

    const userId = authUser.id;
    console.log(`   User ID: ${userId}`);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: ADMIN_EMAIL,
        ...ADMIN_PROFILE,
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Profile Error:', profileError.message);
      process.exit(1);
    }

    console.log('✅ Profile upserted successfully');
    console.log(`   Profile ID: ${profile.id}`);

    console.log('\n🔍 Verifying user...');
    const { data: users, error: verifyError } = await supabase.auth.admin.listUsers();

    if (verifyError) {
      console.error('❌ Verification Error:', verifyError.message);
      process.exit(1);
    }

    const createdUser = users.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

    if (!createdUser) {
      console.error('❌ User not found in auth verification');
      process.exit(1);
    }

    console.log('✅ User verified in auth.users');
    console.log(`   Email: ${createdUser.email}`);
    console.log(`   User ID: ${createdUser.id}`);
    console.log(`   Email Confirmed: ${createdUser.email_confirmed_at ? 'Yes' : 'No'}`);

    console.log('\n📋 Verifying profile in database...');
    const { data: profileData, error: profileVerifyError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileVerifyError) {
      console.error('❌ Profile Verify Error:', profileVerifyError.message);
      process.exit(1);
    }

    if (profileData) {
      console.log('✅ Profile verified in database');
      console.log(`   ID: ${profileData.id}`);
      console.log(`   Email: ${profileData.email}`);
      console.log(`   Name: ${profileData.display_name}`);
      console.log(`   Role: ${profileData.role}`);
      console.log(`   Active: ${profileData.is_active}`);
    } else {
      console.error('❌ Profile not found in database');
      process.exit(1);
    }

    console.log('\n✨ Superadmin is ready.');
    console.log('\nLogin Credentials:');
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
