/**
 * Email/Password Authentication System
 *
 * Custom authentication for the hosting panel.
 * @module oauth2
*/

"use strict";

const settings = require("../settings.json");
const fetch = require("node-fetch");
const bcrypt = require('bcrypt');
const indexjs = require("../app.js");
const log = require("../misc/log");
const fs = require("fs");

if (settings.pterodactyl.domain.slice(-1) == "/")
  settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);

module.exports.load = async function (app, db) {
  // Login page
  app.get("/login", async (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - ${settings.name || 'Hosting Panel'}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg-dark: #0a0a0a;
            --bg-darker: #050505;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --accent: #ffffff;
            --border: #2a2a2a;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-dark);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
            overflow: hidden;
        }

        .login-container {
            width: 100%;
            max-width: 420px;
            z-index: 1;
        }

        .login-card {
            background: var(--bg-darker);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
            position: relative;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo {
            width: 70px;
            height: 70px;
            margin: 0 auto 20px;
            background: var(--accent);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo i {
            font-size: 28px;
            color: var(--bg-dark);
        }

        .title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 15px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-secondary);
            font-size: 14px;
            font-weight: 500;
        }

        input {
            width: 100%;
            padding: 14px 16px;
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 15px;
            transition: all 0.3s ease;
        }

        input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
        }

        .password-container {
            position: relative;
        }

        .password-toggle {
            position: absolute;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
        }

        .login-btn {
            width: 100%;
            padding: 14px;
            background: var(--text-primary);
            color: var(--bg-dark);
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
        }

        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
        }

        .register-link {
            text-align: center;
            margin-top: 25px;
            color: var(--text-secondary);
            font-size: 14px;
        }

        .register-link a {
            color: var(--text-primary);
            text-decoration: none;
            font-weight: 600;
        }

        .register-link a:hover {
            text-decoration: underline;
        }

        .error-message {
            background: rgba(255, 77, 79, 0.1);
            border: 1px solid rgba(255, 77, 79, 0.3);
            color: #ff4d4f;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .success-message {
            background: rgba(0, 228, 0, 0.1);
            border: 1px solid rgba(0, 228, 0, 0.3);
            color: #00e400;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .remember-me {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }

        .remember-me input {
            width: auto;
            margin-right: 8px;
        }

        .remember-me label {
            margin: 0;
        }
    </style>
    </head>
<body>
    <div class="login-container">
        <div class="login-card">
            <div class="header">
                <div class="logo">
                    <i class="fas fa-server"></i>
                </div>
                <h1 class="title">Welcome Back</h1>
                <p class="subtitle">Sign in to access your dashboard</p>
            </div>

            ${req.query.err ? '<div class="error-message"><i class="fas fa-exclamation-circle"></i> ' + (req.query.err === 'INVALID_CREDENTIALS' ? 'Invalid email or password' : req.query.err === 'MISSING_FIELDS' ? 'Please fill in all fields' : req.query.err === 'ACCOUNT_NOT_FOUND' ? 'Account not found on Pterodactyl panel' : req.query.err === 'LOGIN_FAILED' ? 'Login failed. Please try again.' : decodeURIComponent(req.query.err)) + '</div>' : ''}
            ${req.query.success ? '<div class="success-message"><i class="fas fa-check-circle"></i> ' + (req.query.success === 'REGISTERED' ? 'Registration successful! Please login' : 'Success') + '</div>' : ''}

            <form action="/login" method="POST" id="loginForm">
                <div class="form-group">
                    <label for="email"><i class="fas fa-envelope"></i> Email Address</label>
                    <input type="email" id="email" name="email" placeholder="Enter your email" required autofocus>
                </div>

                <div class="form-group">
                    <label for="password"><i class="fas fa-lock"></i> Password</label>
                    <div class="password-container">
                        <input type="password" id="password" name="password" placeholder="Enter your password" required>
                        <button type="button" class="password-toggle" onclick="togglePassword()">
                            <i class="fas fa-eye" id="toggleIcon"></i>
                        </button>
                    </div>
                </div>

                <div class="remember-me">
                    <input type="checkbox" id="remember" name="remember">
                    <label for="remember">Remember me</label>
                </div>

                <button type="submit" class="login-btn">
                    <i class="fas fa-sign-in-alt"></i> Sign In
                </button>
            </form>

            <div class="register-link">
                Don't have an account? <a href="/register">Register now</a>
            </div>
        </div>
    </div>

    <script>
        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const toggleIcon = document.getElementById('toggleIcon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }
        }
    </script>
</body>
</html>`;
    return res.send(html);
  });

  // Register page
  app.get("/register", async (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Register - ${settings.name || 'Hosting Panel'}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg-dark: #0a0a0a;
            --bg-darker: #050505;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --accent: #ffffff;
            --border: #2a2a2a;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-dark);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
            overflow: hidden;
        }

        .register-container {
            width: 100%;
            max-width: 420px;
            z-index: 1;
        }

        .register-card {
            background: var(--bg-darker);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
            position: relative;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .logo {
            width: 70px;
            height: 70px;
            margin: 0 auto 20px;
            background: var(--accent);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .logo i {
            font-size: 28px;
            color: var(--bg-dark);
        }

        .title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 15px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-secondary);
            font-size: 14px;
            font-weight: 500;
        }

        input {
            width: 100%;
            padding: 14px 16px;
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 15px;
            transition: all 0.3s ease;
        }

        input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
        }

        .password-container {
            position: relative;
        }

        .password-toggle {
            position: absolute;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
        }

        .register-btn {
            width: 100%;
            padding: 14px;
            background: var(--text-primary);
            color: var(--bg-dark);
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 10px;
        }

        .register-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
        }

        .login-link {
            text-align: center;
            margin-top: 25px;
            color: var(--text-secondary);
            font-size: 14px;
        }

        .login-link a {
            color: var(--text-primary);
            text-decoration: none;
            font-weight: 600;
        }

        .login-link a:hover {
            text-decoration: underline;
        }

        .error-message {
            background: rgba(255, 77, 79, 0.1);
            border: 1px solid rgba(255, 77, 79, 0.3);
            color: #ff4d4f;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="register-container">
        <div class="register-card">
            <div class="header">
                <div class="logo">
                    <i class="fas fa-user-plus"></i>
                </div>
                <h1 class="title">Create Account</h1>
                <p class="subtitle">Sign up to get started</p>
            </div>

            ${req.query.err ? '<div class="error-message"><i class="fas fa-exclamation-circle"></i> ' + (req.query.err === 'EMAIL_EXISTS' ? 'This email is already registered' : req.query.err === 'PASSWORD_MISMATCH' ? 'Passwords do not match' : req.query.err === 'WEAK_PASSWORD' ? 'Password must be at least 8 characters' : req.query.err === 'INVALID_EMAIL' ? 'Please enter a valid email address' : req.query.err === 'MISSING_FIELDS' ? 'Please fill in all fields including first name and last name' : req.query.err === 'PTERO_ACCOUNT_NOT_FOUND' ? 'Account not found on Pterodactyl panel' : req.query.err === 'PTERO_API_ERROR' ? 'Pterodactyl API error. Please check your configuration.' : req.query.err === 'PTERO_CONNECTION_ERROR' ? 'Cannot connect to Pterodactyl panel. Please check your settings.' : decodeURIComponent(req.query.err)) + '</div>' : ''}

            <form action="/register" method="POST" id="registerForm">
                <div class="form-group">
                    <label for="firstname"><i class="fas fa-user"></i> First Name</label>
                    <input type="text" id="firstname" name="firstname" placeholder="Enter your first name" required autofocus>
                </div>

                <div class="form-group">
                    <label for="lastname"><i class="fas fa-user"></i> Last Name</label>
                    <input type="text" id="lastname" name="lastname" placeholder="Enter your last name" required>
                </div>

                <div class="form-group">
                    <label for="username"><i class="fas fa-at"></i> Username</label>
                    <input type="text" id="username" name="username" placeholder="Choose a username" required>
                </div>

                <div class="form-group">
                    <label for="email"><i class="fas fa-envelope"></i> Email Address</label>
                    <input type="email" id="email" name="email" placeholder="Enter your email" required>
                </div>

                <div class="form-group">
                    <label for="password"><i class="fas fa-lock"></i> Password</label>
                    <div class="password-container">
                        <input type="password" id="password" name="password" placeholder="Enter your password" required>
                        <button type="button" class="password-toggle" onclick="togglePassword()">
                            <i class="fas fa-eye" id="toggleIcon"></i>
                        </button>
                    </div>
                </div>

                <div class="form-group">
                    <label for="confirmPassword"><i class="fas fa-lock"></i> Confirm Password</label>
                    <div class="password-container">
                        <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Confirm your password" required>
                        <button type="button" class="password-toggle" onclick="toggleConfirmPassword()">
                            <i class="fas fa-eye" id="toggleIcon2"></i>
                        </button>
                    </div>
                </div>

                <button type="submit" class="register-btn">
                    <i class="fas fa-user-plus"></i> Create Account
                </button>
            </form>

            <div class="login-link">
                Already have an account? <a href="/login">Sign in</a>
            </div>
        </div>
    </div>

    <script>
        function togglePassword() {
            const passwordInput = document.getElementById('password');
            const toggleIcon = document.getElementById('toggleIcon');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }
        }

        function toggleConfirmPassword() {
            const passwordInput = document.getElementById('confirmPassword');
            const toggleIcon = document.getElementById('toggleIcon2');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }
        }
    </script>
</body>
</html>`;
    return res.send(html);
  });

  // Handle registration POST
  app.post("/register", async (req, res) => {
    const { firstname, lastname, username, email, password, confirmPassword } = req.body;
    
    // Validation
    if (!firstname || !lastname || !username || !email || !password || !confirmPassword) {
      return res.redirect("/register?err=MISSING_FIELDS");
    }

    if (password !== confirmPassword) {
      return res.redirect("/register?err=PASSWORD_MISMATCH");
    }

    if (password.length < 8) {
      return res.redirect("/register?err=WEAK_PASSWORD");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.redirect("/register?err=INVALID_EMAIL");
    }

    try {
      // Check if email already exists
      const existingUser = await db.get(`user-${email}`);
      if (existingUser) {
        return res.redirect("/register?err=EMAIL_EXISTS");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user in database
      const userId = Date.now().toString();
      const userData = {
        id: userId,
        firstname: firstname,
        lastname: lastname,
        username: username,
        email: email,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      await db.set(`user-${email}`, userData);
      await db.set(`user-by-id-${userId}`, userData);

      // Create Pterodactyl account
      let genpassword = makeid(16);
      
      const accountjson = await fetch(
              settings.pterodactyl.domain + "/api/application/users",
              {
                method: "post",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${settings.pterodactyl.key}`,
                },
                body: JSON.stringify({
            username: username,
            email: email,
            first_name: firstname,
            last_name: lastname,
                  password: genpassword,
                }),
              }
            );

      let accountinfo;
      const accountResponse = await accountjson;
      
      if (accountResponse.status === 201) {
        // Successfully created new Pterodactyl account
        accountinfo = await accountResponse.json();
        
        // Debug: Log the actual response structure
        console.log("Pterodactyl account creation response:", JSON.stringify(accountinfo, null, 2));
        
        let userids = (await db.get("users")) ? await db.get("users") : [];
        let accountId;
        
        // Handle different response structures
        if (accountinfo.data && accountinfo.data.attributes) {
          accountId = accountinfo.data.attributes.id;
        } else if (accountinfo.attributes) {
          accountId = accountinfo.attributes.id;
        } else {
          console.error("Unexpected Pterodactyl account creation response structure:", accountinfo);
          return res.redirect("/register?err=PTERO_API_ERROR");
        }
        
        userids.push(accountId);
        await db.set("users", userids);
        await db.set("users-" + userId, accountId);
        req.session.newaccount = true;
        req.session.password = genpassword;
        
        console.log("Successfully created Pterodactyl account:", accountId);
      } else {
        // Account creation failed, check if user already exists
        console.log("Pterodactyl account creation failed, checking if user exists. Status:", accountResponse.status);
        
        try {
          const accountlistjson = await fetch(
            settings.pterodactyl.domain +
              "/api/application/users?include=servers&filter[email]=" +
              encodeURIComponent(email),
            {
              method: "get",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${settings.pterodactyl.key}`,
              },
            }
          );
          
          if (accountlistjson.status === 200) {
            let accountlist = await accountlistjson.json();
            
            // Debug: Log the actual response structure
            console.log("Pterodactyl account list response:", JSON.stringify(accountlist, null, 2));
            
            let users = [];
            if (accountlist.data && Array.isArray(accountlist.data)) {
              users = accountlist.data;
            } else if (Array.isArray(accountlist)) {
              users = accountlist;
            } else {
              console.error("Unexpected account list response structure:", accountlist);
              return res.redirect("/register?err=PTERO_API_ERROR");
            }
            
            let user = users.filter(
              (acc) => acc.attributes && acc.attributes.email === email
            );
            
            if (user.length === 1) {
              let userid = user[0].attributes.id;
              let userids = (await db.get("users")) ? await db.get("users") : [];
              if (userids.filter((id) => id === userid).length === 0) {
                userids.push(userid);
                await db.set("users", userids);
              }
              await db.set("users-" + userId, userid);
              console.log("Found existing Pterodactyl account:", userid);
            } else {
              console.error("No existing Pterodactyl account found for email:", email);
              return res.redirect("/register?err=PTERO_ACCOUNT_NOT_FOUND");
            }
          } else {
            console.error("Failed to check existing Pterodactyl accounts. Status:", accountlistjson.status);
            return res.redirect("/register?err=PTERO_API_ERROR");
          }
        } catch (pteroError) {
          console.error("Error checking existing Pterodactyl accounts:", pteroError);
          return res.redirect("/register?err=PTERO_CONNECTION_ERROR");
        }
      }

      log("signup", `${username} registered with email ${email}`);
      return res.redirect("/login?success=REGISTERED");
    } catch (error) {
      console.error("Registration error:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      return res.redirect("/register?err=" + encodeURIComponent(error.message || "REGISTRATION_FAILED"));
    }
  });

  // Handle login POST
  app.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      console.log("Login attempt for:", email);

      if (!email || !password) {
        return res.redirect("/login?err=MISSING_FIELDS");
      }
      
      // Get user from database
      const userData = await db.get(`user-${email}`);
      if (!userData) {
        return res.redirect("/login?err=INVALID_CREDENTIALS");
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, userData.password);
      if (!passwordMatch) {
        return res.redirect("/login?err=INVALID_CREDENTIALS");
      }

      // Set session
      req.session.userinfo = userData;
      
      // Get Pterodactyl account ID
      const pterodactylId = await db.get("users-" + userData.id);
      
      if (!pterodactylId) {
        console.error("No Pterodactyl account ID found for user:", userData.id);
        return res.redirect("/login?err=ACCOUNT_NOT_FOUND");
      }
      
      // Get Pterodactyl account
      let cacheaccount = await fetch(
        settings.pterodactyl.domain +
          "/api/application/users/" +
          pterodactylId +
          "?include=servers",
        {
          method: "get",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.pterodactyl.key}`,
          },
        }
      );
      
      if (cacheaccount.status !== 200) {
        console.error("Pterodactyl fetch failed. Status:", cacheaccount.status, "Response:", await cacheaccount.text());
        return res.redirect("/login?err=ACCOUNT_NOT_FOUND");
      }
      
      let cacheaccountinfo = await cacheaccount.json();
      
      // Debug: Log the actual response structure
      console.log("Pterodactyl API response:", JSON.stringify(cacheaccountinfo, null, 2));
      
      // Handle different response structures
      if (cacheaccountinfo.data && cacheaccountinfo.data.attributes) {
        req.session.pterodactyl = cacheaccountinfo.data.attributes;
      } else if (cacheaccountinfo.attributes) {
        req.session.pterodactyl = cacheaccountinfo.attributes;
      } else {
        console.error("Unexpected Pterodactyl API response structure:", cacheaccountinfo);
        return res.redirect("/login?err=ACCOUNT_NOT_FOUND");
      }

      console.log("Successfully logged in user:", userData.username, "with Pterodactyl ID:", pterodactylId);

      let theme = indexjs.get(req);
      return res.redirect(
        theme.settings.redirect.callback
          ? theme.settings.redirect.callback
          : "/dashboard"
      );
    } catch (error) {
      console.error("Login error:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      return res.redirect("/login?err=" + encodeURIComponent(error.message || "LOGIN_FAILED"));
    }
  });

  app.get("/logout", (req, res) => {
    let theme = indexjs.get(req);
    req.session.destroy(() => {
      return res.redirect(
        theme.settings.redirect.logout ? theme.settings.redirect.logout : "/"
      );
    });
  });
};

function makeid(length) {
  let result = "";
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}