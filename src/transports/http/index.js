// Canvas service interface
const Service = require("../../managers/service/lib/Service");

// Utils
const debug = require("debug")("canvas:transports:http");
const bodyParser = require("body-parser");
const ResponseObject = require("../../schemas/transport/responseObject");
const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken"); // Import jsonwebtoken

// Defaults
const DEFAULT_PROTOCOL = "http";
const DEFAULT_HOST = "0.0.0.0"; // TODO: Change me, this is to make Docker happy if no config is supplied
const DEFAULT_PORT = 8000;
const DEFAULT_ACCESS_TOKEN = "canvas-server-token";
const DEFAULT_JWT_SECRET = "your-jwt-secret-key"; // Default JWT secret

// REST API defaults
const DEFAULT_API_BASE_PATH = "/rest";
const DEFAULT_API_VERSION = "v1";

// Middleware functions
// TODO: Move to utils
function validateApiKey(key) {
  return (req, res, next) => {
    const apiKey =
      req.headers["authorization"] ||
      req?.query["access_token"] ||
      req?.body["access_token"] ||
      req?.params["access_token"];

    debug("Validating AUTH key");
    debug(`Auth Timestamp: ${new Date().toISOString()}`);
    debug(`User-Agent: ${req.get("User-Agent")}`);
    debug(`Request Method: ${req.method}`);
    debug(`Request URL: ${req.originalUrl}`);
    debug(`Client IP: ${req.ip}`);

    if (!apiKey) {
      debug("Unauthorized: No API Key provided");
      return res.status(401).send("Unauthorized: No API Key provided");
    }

    if (apiKey === `Bearer ${key}`) {
      debug("API Key validated successfully");
      next();
    } else {
      debug("Unauthorized: Invalid API Key");
      res.status(401).send("Unauthorized: Invalid API Key");
    }
  };
}

class HttpTransport extends Service {
  #protocol;
  #host;
  #port;
  #auth;
  jwtSecret;

  constructor({
    protocol = DEFAULT_PROTOCOL,
    host = DEFAULT_HOST,
    port = DEFAULT_PORT,
    baseUrl = `${DEFAULT_API_BASE_PATH}/${DEFAULT_API_VERSION}`,
    auth = {
      token: DEFAULT_ACCESS_TOKEN,
      enabled: true,
    },
    jwtSecret = DEFAULT_JWT_SECRET, // Accept JWT secret in constructor
    ...options
  } = {}) {
    super(options);
    this.server = null;

    this.#protocol = protocol;
    this.#host = host;
    this.#port = port;
    this.#auth = auth;
    this.restApiBasePath = baseUrl;
    this.jwtSecret = jwtSecret; // Store JWT secret

    // The really ugly part
    if (!options.canvas) {
      throw new Error("Canvas not defined");
    }
    this.canvas = options.canvas;

    if (!options.db) {
      throw new Error("DB not defined");
    }
    this.db = options.db;

    if (!options.contextManager) {
      throw new Error("contextManager not defined");
    }
    this.contextManager = options.contextManager;

    if (!options.sessionManager) {
      throw new Error("sessionManager not defined");
    }
    this.sessionManager = options.sessionManager;

    this.ResponseObject = ResponseObject; // TODO: Refactor

    // Workaround till I implement proper multi-context routes!
    this.session = this.sessionManager.createSession();
    this.context = this.session.getContext();

    debug(
      `HTTP Transport class initialized, protocol: ${this.#protocol}, host: ${
        this.#host
      }, port: ${this.#port}, rest base path: ${this.restApiBasePath}`
    );
    debug("Auth:", this.#auth.enabled ? "enabled" : "disabled");
  }

  // Function to generate JWT
  generateToken(user) {
    return jwt.sign({ userId: user.id }, this.jwtSecret, { expiresIn: "1h" }); // Set expiration as needed
  }

  // Middleware to authenticate JWT
  authenticateJWT(req, res, next) {
    const token = req.headers["authorization"]?.split(" ")[1]; // Get token from header

    if (!token) {
      return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, this.jwtSecret, (err, user) => {
      if (err) {
        return res.sendStatus(403); // Forbidden
      }

      req.user = user; // Attach user to request object
      next(); // Proceed to the next middleware or route handler
    });
  }

  async start() {
    const app = express();

    // Configure Middleware
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Add CSP headers
    app.use((req, res, next) => {
      res.setHeader("Content-Security-Policy", "default-src 'self'");
      res.setHeader("Access-Control-Allow-Origin", "*");
      next();
    });

    /**
     * Common routes
     */

    // REST API Ping health check (unauthenticated)
    app.get(`${this.restApiBasePath}/ping`, (req, res) => {
      res.status(200).send("pong");
    });

    // Toggle API Key validation
    if (this.#auth.enabled) {
      app.use(validateApiKey(this.#auth.token));
    }

    /**
     * REST API routes
     */

    // Login route to generate JWT
    app.post(`${this.restApiBasePath}/login`, (req, res) => {
      const { token } = req.body;

      if (token !== this.#auth.token) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const user = { id: 1 }; // Replace this with actual user data
      const accessToken = this.generateToken(user);

      return res.json({ accessToken });
    });

    // Example of a protected route
    app.get(
      `${this.restApiBasePath}/protected`,
      this.authenticateJWT.bind(this),
      (req, res) => {
        res.json({ message: "This is a protected route.", user: req.user });
      }
    );

    require("./rest/init")(app, this);

    // Create the HTTP server
    const server = http.createServer(app);

    /**
     * Socket.io routes
     */
    const io = socketIo(server);
    require("./socket.io/init")(io, this);

    /**
     * WebDAV
     */

    // require('./webdav/init')(app, this);

    server.listen(this.#port, this.#host, () => {
      console.log(`Server running at http://${this.#host}:${this.#port}/`);
    });

    this.server = server;
  }

  async stop() {
    if (this.server) {
      debug("Shutting down server...");
      this.server.close((err) => {
        if (err) {
          console.error("Error shutting down server:", err);
          process.exit(1);
        }
        console.log("Server gracefully shut down");
        process.exit(0);
      });

      // Close all socket.io connections
      if (this.io) {
        this.io.close();
      }
    }
  }

  async restart() {
    if (this.isRunning()) {
      await this.stop();
      await this.start();
    }
  }

  status() {
    if (!this.server) {
      return { listening: false };
    }

    let clientsCount = 0;
    for (const [id, socket] of this.server.sockets.sockets) {
      if (socket.connected) {
        clientsCount++;
      }
    }

    return {
      protocol: this.#protocol,
      host: this.#host,
      port: this.#port,
      listening: true,
      connectedClients: clientsCount,
    };
  }
}

module.exports = HttpTransport;
