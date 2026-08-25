const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["*.trycloudflare.com"],
  turbopack: {
    root: import.meta.dirname
  }
};

export default nextConfig;
