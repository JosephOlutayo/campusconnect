package app.campusconnect.seed;

import app.campusconnect.domain.Category;
import app.campusconnect.repository.CategoryRepository;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * The service categories every deployment starts with.
 *
 * These are reference data, not demo data: a marketplace with no categories
 * cannot list a single service, so a real deployment needs them just as much as
 * the demo does. Both {@link DataSeeder} and {@link BootstrapRunner} create them
 * from this one list so the two can never drift apart.
 *
 * An operator is free to rename, reorder or add to these from the admin console
 * afterwards. Nothing here is campus-specific.
 */
final class ServiceCatalog {

    private ServiceCatalog() {
    }

    /** name, slug, icon, colour, description, comma-separated search keywords. */
    private static final Object[][] ROWS = {
            {"Barbering", "barbering", "💈", "#2563EB", "Cuts, fades, line-ups and beard work.", "barber,haircut,fade,taper,lineup,cut,trim,beard"},
            {"Braiding", "braiding", "🪢", "#DB2777", "Box braids, knotless, cornrows and twists.", "braids,braider,knotless,box braids,cornrows,twists"},
            {"Hair Styling", "hair-styling", "💇", "#9333EA", "Silk press, colour, installs and styling.", "hair,hairdresser,stylist,silk press,color,wig,install"},
            {"Nails", "nails", "💅", "#F43F5E", "Acrylics, gel, manicures and nail art.", "nails,nail tech,acrylic,gel,manicure,pedicure,nail art"},
            {"Makeup", "makeup", "💄", "#EC4899", "Event glam, natural beat and lessons.", "makeup,mua,glam,beat,formal,prom,bridal"},
            {"Lashes & Brows", "lashes-brows", "👁️", "#A855F7", "Extensions, lifts, tints and threading.", "lashes,lash tech,extensions,brows,eyebrows,threading,tint"},
            {"Tattoo & Piercing", "tattoo", "🖋️", "#4F46E5", "Small tattoos, flash and piercings.", "tattoo,tattoos,ink,piercing,flash"},
            {"Photography", "photography", "📷", "#0EA5E9", "Grad photos, portraits and events.", "photo,photography,photographer,grad photos,portraits,headshots"},
            {"Videography", "videography", "🎬", "#0891B2", "Event films, reels and content days.", "video,videography,videographer,film,reels,content"},
            {"Tutoring", "tutoring", "📚", "#16A34A", "Course-specific help from students who aced it.", "tutor,tutoring,math,calculus,statistics,chemistry,physics,study,exam"},
            {"Fitness", "fitness", "🏋️", "#EA580C", "Personal training and programming.", "fitness,trainer,personal trainer,gym,workout,lifting,coach"},
            {"Car Care", "car-care", "🚗", "#0F766E", "Detailing, washes and interior resets.", "car,detailing,detail,wash,car wash,auto,interior"},
            {"Tailoring", "tailoring", "🧵", "#B45309", "Alterations, hemming and custom pieces.", "tailor,tailoring,alterations,hem,sewing,seamstress,suit"},
            {"DJ & Events", "dj-events", "🎧", "#7C3AED", "Parties, formals and campus events.", "dj,music,party,event,mix,sound,formal"},
            {"Cleaning", "cleaning", "🧽", "#0284C7", "Dorm and apartment deep cleans.", "cleaning,cleaner,deep clean,dorm,apartment,move out"},
            {"Design & Digital", "design", "🎨", "#6366F1", "Logos, flyers, decks and web work.", "design,graphic design,designer,logo,flyer,branding,website,resume"},
    };

    static int size() {
        return ROWS.length;
    }

    /** Saves every category and returns them keyed by slug. */
    static Map<String, Category> createAll(CategoryRepository categories) {
        Map<String, Category> map = new LinkedHashMap<>();
        int order = 0;
        for (Object[] row : ROWS) {
            Set<String> keywords = new LinkedHashSet<>(Arrays.asList(((String) row[5]).split(",")));
            Category category = categories.save(new Category((String) row[0], (String) row[1],
                    (String) row[2], (String) row[4], keywords, (String) row[3], order++));
            map.put(category.getSlug(), category);
        }
        return map;
    }
}
