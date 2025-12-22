import { z } from 'zod';

const exampleSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long").max(100, "Name cannot exceed 100 characters"),
  email: z.string().email("Invalid email address").optional(),
  age: z.number().int().positive("Age must be a positive integer").optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const validation = exampleSchema.safeParse(json);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error.formErrors.fieldErrors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { name, email, age } = validation.data;

    // In a real application, you would process the validated data here
    // For demonstration, we just return a success message
    return new Response(JSON.stringify({ message: "Data received and validated successfully!", data: { name, email, age } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
