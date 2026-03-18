import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PASSWORDS_FILE = path.join(process.cwd(), "data", "passwords.json");

export async function POST(request: Request) {
  try {
    const { masterPassword, newSimplePassword } = await request.json();

    if (!fs.existsSync(PASSWORDS_FILE)) {
      return NextResponse.json(
        { message: "Server error: Passwords file missing" },
        { status: 500 },
      );
    }

    const data = JSON.parse(fs.readFileSync(PASSWORDS_FILE, "utf-8"));

    if (masterPassword === data.masterPassword) {
      data.simplePassword = newSimplePassword;
      fs.writeFileSync(PASSWORDS_FILE, JSON.stringify(data, null, 2));
      return NextResponse.json({
        success: true,
        message: "Password updated successfully",
      });
    }

    return NextResponse.json(
      { success: false, message: "Incorrect master password" },
      { status: 401 },
    );
  } catch (error) {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
}
