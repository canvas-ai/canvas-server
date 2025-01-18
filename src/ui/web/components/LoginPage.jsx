import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <img
        src="/assets/icons/logo_1024x1024_v2.png"
        alt="Canvas Logo"
        className="w-32 h-32 mb-8 object-contain"
      />

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome to Canvas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Enter your email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Enter your password" />
          </div>
          <div className="flex flex-col space-y-2">
            <Button onClick={() => window.location.href = '/auth/login'}>
              Login
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/auth/register'}
            >
              Register
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;