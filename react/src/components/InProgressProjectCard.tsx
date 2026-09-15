import { useNavigate } from "react-router";
import { Pencil, CalendarClock } from "lucide-react";
import { ImageWithFallback } from "./ui/ImageWithFallback";

interface InProgressProjectCardProps {
  id: string;
  title: string;
  image: string;
  category: string;
  dateUpdated?: string;
}

export function InProgressProjectCard({ id, title, image, category, dateUpdated }: Readonly<InProgressProjectCardProps>) {
  const navigate = useNavigate();

  const formatUpdatedLabel = (value?: string) => {
    if (!value) return "Recently";

    const trimmed = value.trim();

    // Handle unix timestamps (seconds or milliseconds)
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const timestampMs = trimmed.length <= 10 ? numeric * 1000 : numeric;
      const date = new Date(timestampMs);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }

    // Handle MySQL datetime strings like "YYYY-MM-DD HH:MM:SS"
    const normalized = trimmed.includes(" ") ? trimmed.replace(" ", "T") : trimmed;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    return "Recently";
  };

  const updatedLabel = formatUpdatedLabel(dateUpdated);

  return (
    <button
      type="button"
      onClick={() => navigate(`/in-progress/${id}`)}
      className="group block w-full text-left"
    >
      <div className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="aspect-[4/3] overflow-hidden bg-gray-100">
          <ImageWithFallback
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2 gap-2">
            <h3 className="font-medium truncate">{title}</h3>
            <span className="text-xs bg-[#faf9f6] px-2 py-1 rounded-full text-[#1c110a] flex-shrink-0">
              {category}
            </span>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 text-sm text-[#1c110a]">
              <CalendarClock className="w-4 h-4" />
              <span>Updated {updatedLabel}</span>
            </div>

            <div className="inline-flex items-center gap-1 text-sm text-[#c2350a]">
              <Pencil className="w-4 h-4" />
              <span>Edit</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
