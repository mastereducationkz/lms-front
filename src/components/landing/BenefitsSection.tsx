import { BookOpen, CheckCircle } from "lucide-react";

export function BenefitsSection() {
  const benefits = [
    "Modern and intuitive user interface",
    "Support for various content types (video, text, quizzes)",
    "Real-time system with WebSocket",
    "Full mobile responsiveness",
    "Secure authentication and data protection",
    "Detailed analytics and reporting",
    "Scalability for any number of users",
    "24/7 technical support",
  ];

  return (
    <section id="benefits" className="py-20">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-balance mb-6">Master Education Benefits</h2>
            <p className="text-lg text-muted-foreground text-balance leading-relaxed mb-8">
              Our platform combines the best practices of modern education with cutting-edge technologies to create an
              unparalleled learning experience.
            </p>

            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-8 h-96 flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="mx-auto mb-4 h-14 w-14 text-primary" strokeWidth={1.5} aria-hidden="true" />
                <h3 className="text-xl font-semibold mb-2">Education of the Future</h3>
                <p className="text-muted-foreground">Available today at mastereducation.kz</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default BenefitsSection;


